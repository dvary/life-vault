const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pdfParse = require('pdf-parse');
const { query } = require('../config/database');

const pendingAnalyses = new Map();
const PENDING_TTL_MS = 30 * 60 * 1000;

const VITAL_PATTERNS = [
  { type: 'hemoglobin', unit: 'g/dL', regex: /(?:hemoglobin|haemoglobin|\bhb\b)(?:[\s:(]*|.*?\n.*?){0,3}?(\d+\.?\d*)\s*(?:g\/dl|gm\/dl|g\/dL)?/i },
  { type: 'cholesterol', unit: 'mg/dL', regex: /(?:total\s*cholesterol|cholesterol\s*\(total\)|serum\s*cholesterol)(?:[\s:(]*|.*?\n.*?){0,3}?(\d+\.?\d*)/i },
  { type: 'sgpt', unit: 'U/L', regex: /(?:sgpt|\balt\b|alanine)(?:[\s:(]*|.*?\n.*?){0,3}?(\d+\.?\d*)/i },
  { type: 'sgot', unit: 'U/L', regex: /(?:sgot|\bast\b|aspartate)(?:[\s:(]*|.*?\n.*?){0,3}?(\d+\.?\d*)/i },
  { type: 'vitamin_d', unit: 'ng/mL', regex: /(?:vitamin\s*d|25[\s-]*\(oh\))(?:[\s:(]*|.*?\n.*?){0,3}?(\d+\.?\d*)/i },
  { type: 'thyroid_tsh', unit: 'μIU/mL', regex: /(?:\btsh\b|thyroid stimulating)(?:[\s:(]*|.*?\n.*?){0,3}?(\d+\.?\d*)/i },
  { type: 'thyroid_t3', unit: 'ng/dL', regex: /(?:\bt3\b|triiodothyronine)(?:[\s:(]*|.*?\n.*?){0,3}?(\d+\.?\d*)/i },
  { type: 'thyroid_t4', unit: 'μg/dL', regex: /(?:\bt4\b|thyroxine)(?:[\s:(]*|.*?\n.*?){0,3}?(\d+\.?\d*)/i },
  { type: 'vitamin_b12', unit: 'pg/mL', regex: /(?:vitamin\s*b[\s-]*12|\bb12\b)(?:[\s:(]*|.*?\n.*?){0,3}?(\d+\.?\d*)/i },
  { type: 'calcium', unit: 'mg/dL', regex: /(?:\bcalcium\b|serum calcium)(?:[\s:(]*|.*?\n.*?){0,3}?(\d+\.?\d*)/i },
  { type: 'hba1c', unit: '%', regex: /(?:hba1c|hb\s*a1c|glycated)(?:[\s:(]*|.*?\n.*?){0,3}?(\d+\.?\d*)/i },
  { type: 'urea', unit: 'mg/dL', regex: /(?:blood\s*urea|\burea\b|bun)(?:[\s:(]*|.*?\n.*?){0,3}?(\d+\.?\d*)/i },
  { type: 'fasting_blood_glucose', unit: 'mg/dL', regex: /(?:fasting\s*(?:blood\s*)?glucose|\bfbs\b|\bfbg\b|blood sugar)(?:[\s:(]*|.*?\n.*?){0,3}?(\d+\.?\d*)/i },
  { type: 'creatinine', unit: 'mg/dL', regex: /(?:\bcreatinine\b|serum creatinine)(?:[\s:(]*|.*?\n.*?){0,3}?(\d+\.?\d*)/i },
];

const REPORT_KEYWORDS = [
  'lab report', 'pathology', 'biochemistry', 'hematology', 'blood test',
  'lipid profile', 'cbc', 'complete blood count', 'thyroid profile', 'hba1c',
  'diagnostic', 'reference range', 'test result', 'investigation', 'laboratory',
  'serum', 'plasma', 'mg/dl', 'g/dl', 'u/l', 'patient name', 'sample collected',
  'haemoglobin', 'hemoglobin', 'glucose', 'cholesterol'
];

const DOCUMENT_KEYWORDS = [
  'insurance policy', 'policy document', 'certificate of', 'aadhaar', 'passport',
  'voter id', 'driving licence', 'driving license', 'birth certificate',
  'identity card', 'terms and conditions', 'agreement between'
];

const VITAL_LABELS = {
  hemoglobin: 'Hemoglobin', cholesterol: 'Cholesterol', sgpt: 'SGPT', sgot: 'SGOT',
  vitamin_d: 'Vitamin D', thyroid_tsh: 'TSH', thyroid_t3: 'T3', thyroid_t4: 'T4',
  vitamin_b12: 'Vitamin B12', calcium: 'Calcium', hba1c: 'HbA1c', urea: 'Urea',
  fasting_blood_glucose: 'Fasting Glucose', creatinine: 'Creatinine',
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const emit = async (onStep, step) => {
  onStep(step);
  await delay(100);
};

const extractPdfText = async (buffer, filename) => {
  const pdfData = await pdfParse(buffer, { max: 0 });
  const rawText = (pdfData.text || '').replace(/\r/g, '\n');
  const metaParts = [pdfData.info?.Title, pdfData.info?.Author, pdfData.info?.Subject].filter(Boolean);
  const filenameHint = filename.replace(/\.pdf$/i, '').replace(/[_\-.]+/g, ' ');
  const combined = [rawText, ...metaParts, filenameHint].join('\n').trim();

  return {
    text: combined,
    rawText,
    pageCount: pdfData.numpages || 0,
    charCount: combined.length,
    fromMetadata: metaParts.length > 0,
  };
};

const identifyMember = (text, members) => {
  const searchArea = text.slice(0, 6000).toLowerCase();
  let best = null;
  let bestScore = 0;

  for (const member of members) {
    const fullName = member.name.toLowerCase();
    const parts = fullName.split(/\s+/).filter((p) => p.length > 2);
    let score = 0;

    if (searchArea.includes(fullName)) score += 10;
    for (const part of parts) {
      if (searchArea.includes(part)) score += 3;
    }

    if (score > bestScore) {
      bestScore = score;
      best = { member, score, confidence: score >= 10 ? 'high' : score >= 6 ? 'medium' : 'low' };
    }
  }

  return bestScore >= 3 ? best : null;
};

const extractReportDate = (text) => {
  const patterns = [
    /(?:report\s*date|sample\s*(?:collected|collection)\s*(?:on|date)|collected\s*on|date\s*of\s*report|dated|visit\s*date)[:\s]*(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/i,
    /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/,
    /(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let year, month, day;
      if (match[0].match(/^\d{4}/)) {
        year = parseInt(match[1], 10);
        month = parseInt(match[2], 10);
        day = parseInt(match[3], 10);
      } else {
        day = parseInt(match[1], 10);
        month = parseInt(match[2], 10);
        year = parseInt(match[3], 10);
        if (year < 100) year += 2000;
      }
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1990 && year <= 2100) {
        return new Date(Date.UTC(year, month - 1, day)).toISOString().split('T')[0];
      }
    }
  }

  return new Date().toISOString().split('T')[0];
};

const classifyContent = (text) => {
  const lower = text.toLowerCase();
  let reportScore = 0;
  let documentScore = 0;

  for (const keyword of REPORT_KEYWORDS) {
    if (lower.includes(keyword)) reportScore += 1;
  }
  for (const keyword of DOCUMENT_KEYWORDS) {
    if (lower.includes(keyword)) documentScore += 2;
  }

  if (reportScore >= 1 && reportScore >= documentScore) {
    let reportType = 'lab_report';
    let reportSubType = 'general_lab';

    if (/prescription|rx\b|medicine|tablet|capsule/i.test(lower)) {
      reportType = 'prescription_consultation';
      reportSubType = 'prescription';
    } else if (/vaccin|immuniz/i.test(lower)) {
      reportType = 'vaccination';
      reportSubType = 'other_vaccine';
    } else if (/discharge|admission|hospital|operation|surgery/i.test(lower)) {
      reportType = 'hospital_records';
      reportSubType = 'general_hospital';
    } else if (/x[\s-]?ray|radiograph/i.test(lower)) {
      reportSubType = 'xray';
    } else if (/ultrasound|sonography/i.test(lower)) {
      reportSubType = 'ultrasound';
    } else if (/\bmri\b/i.test(lower)) {
      reportSubType = 'mri';
    } else if (/ct\s*scan/i.test(lower)) {
      reportSubType = 'ct_scan';
    } else if (/blood|cbc|hematology|biochemistry/i.test(lower)) {
      reportSubType = 'blood_report';
    }

    return { category: 'report', reportType, reportSubType, confidence: reportScore };
  }

  return { category: 'document', confidence: documentScore };
};

const extractVitals = (text, reportDate) => {
  const vitals = [];
  const seen = new Set();
  const searchTexts = [text, text.replace(/\n/g, ' ')];

  for (const pattern of VITAL_PATTERNS) {
    if (seen.has(pattern.type)) continue;

    for (const searchText of searchTexts) {
      const match = searchText.match(pattern.regex);
      if (match) {
        const value = parseFloat(match[1]);
        if (!Number.isNaN(value) && value > 0 && value < 10000) {
          seen.add(pattern.type);
          vitals.push({
            vitalType: pattern.type,
            label: VITAL_LABELS[pattern.type] || pattern.type,
            value,
            unit: pattern.unit,
            recordedAt: reportDate,
            notes: 'Auto-extracted from uploaded PDF by Life Vault agent',
          });
          break;
        }
      }
    }
  }

  return vitals;
};

const storePending = (analysisId, data) => {
  pendingAnalyses.set(analysisId, { ...data, createdAt: Date.now() });
  for (const [id, entry] of pendingAnalyses) {
    if (Date.now() - entry.createdAt > PENDING_TTL_MS) {
      pendingAnalyses.delete(id);
    }
  }
};

const getPending = (analysisId, familyId) => {
  const entry = pendingAnalyses.get(analysisId);
  if (!entry || entry.familyId !== familyId) return null;
  if (Date.now() - entry.createdAt > PENDING_TTL_MS) {
    pendingAnalyses.delete(analysisId);
    return null;
  }
  return entry;
};

const analyzePdfAgent = async ({ file, user, onStep }) => {
  const uploadDir = process.env.UPLOAD_PATH || '/app/uploads';
  const analysisId = crypto.randomUUID();

  await emit(onStep, {
    id: 'upload',
    status: 'done',
    title: 'PDF Received',
    message: `Uploaded ${file.originalname}`,
  });

  await emit(onStep, {
    id: 'extract',
    status: 'running',
    title: 'Extracting Text',
    message: 'Reading PDF content and metadata...',
  });

  const filePath = path.join(uploadDir, file.filename);
  const buffer = fs.readFileSync(filePath);
  const extraction = await extractPdfText(buffer, file.originalname);

  if (extraction.charCount < 8) {
    await emit(onStep, {
      id: 'extract',
      status: 'error',
      title: 'Extracting Text',
      message: 'This PDF appears to be a scanned image. Please use a digital/text-based PDF export from your lab.',
    });
    throw new Error('Could not extract text from PDF');
  }

  const extractNote = extraction.pageCount
    ? `${extraction.charCount.toLocaleString()} chars from ${extraction.pageCount} page(s)${extraction.fromMetadata ? ' + metadata' : ''}`
    : `${extraction.charCount.toLocaleString()} characters extracted`;

  await emit(onStep, {
    id: 'extract',
    status: 'done',
    title: 'Extracting Text',
    message: extractNote,
  });

  await emit(onStep, {
    id: 'members',
    status: 'running',
    title: 'Identifying Member',
    message: 'Matching against family members...',
  });

  const membersResult = await query(
    'SELECT id, name FROM family_members WHERE family_id = $1 ORDER BY name',
    [user.family_id]
  );
  const members = membersResult.rows;

  if (members.length === 0) {
    await emit(onStep, {
      id: 'members',
      status: 'error',
      title: 'Identifying Member',
      message: 'No family members found. Add a member first.',
    });
    throw new Error('No family members found');
  }

  const memberMatch = identifyMember(extraction.text, members);
  const defaultMember = memberMatch?.member || members[0];

  await emit(onStep, {
    id: 'members',
    status: 'done',
    title: 'Identifying Member',
    message: memberMatch
      ? `Best match: ${memberMatch.member.name} (${memberMatch.confidence} confidence)`
      : `Could not auto-match — defaulting to ${defaultMember.name}. Please review.`,
    data: { memberId: defaultMember.id, memberName: defaultMember.name },
  });

  await emit(onStep, {
    id: 'classify',
    status: 'running',
    title: 'Classifying Document',
    message: 'Determining if this is a medical report or general document...',
  });

  const classification = classifyContent(extraction.text);
  const reportDate = extractReportDate(extraction.text);
  const title = file.originalname.replace(/\.[^/.]+$/, '');
  const vitals = classification.category === 'report' ? extractVitals(extraction.text, reportDate) : [];

  await emit(onStep, {
    id: 'classify',
    status: 'done',
    title: 'Classifying Document',
    message: classification.category === 'report'
      ? `Medical report — ${classification.reportType.replace(/_/g, ' ')}`
      : 'General document',
    data: { ...classification, reportDate },
  });

  if (classification.category === 'report') {
    await emit(onStep, {
      id: 'vitals',
      status: 'done',
      title: 'Extracting Vitals',
      message: vitals.length
        ? `Found ${vitals.length} lab value${vitals.length === 1 ? '' : 's'} to import`
        : 'No lab values detected — report will still be saved',
      data: { vitals },
    });
  } else {
    await emit(onStep, {
      id: 'vitals',
      status: 'skipped',
      title: 'Extracting Vitals',
      message: 'Not applicable for general documents',
    });
  }

  const proposal = {
    analysisId,
    memberId: defaultMember.id,
    memberName: defaultMember.name,
    memberConfidence: memberMatch?.confidence || 'manual',
    category: classification.category,
    reportType: classification.reportType,
    reportSubType: classification.reportSubType,
    reportDate,
    title,
    vitals,
    fileName: file.originalname,
  };

  storePending(analysisId, {
    familyId: user.family_id,
    file,
    proposal,
    text: extraction.text,
  });

  await emit(onStep, {
    id: 'review',
    status: 'waiting',
    title: 'Review Required',
    message: 'Please confirm details before saving',
  });

  return {
    analysisId,
    proposal,
    members: members.map((m) => ({ id: m.id, name: m.name })),
  };
};

const confirmPdfAgent = async ({ analysisId, user, overrides = {}, onStep }) => {
  const pending = getPending(analysisId, user.family_id);
  if (!pending) {
    throw new Error('Analysis expired or not found. Please upload again.');
  }

  const { file, proposal } = pending;
  const memberId = overrides.memberId || proposal.memberId;
  const category = overrides.category || proposal.category;
  const reportDate = overrides.reportDate || proposal.reportDate;
  const vitals = overrides.vitals || proposal.vitals;
  const title = overrides.title || proposal.title;

  const memberCheck = await query(
    'SELECT id, name FROM family_members WHERE id = $1 AND family_id = $2',
    [memberId, user.family_id]
  );
  if (memberCheck.rows.length === 0) {
    throw new Error('Invalid member selected');
  }
  const member = memberCheck.rows[0];

  let savedRecord = null;
  const vitalsSaved = [];

  if (category === 'report') {
    await emit(onStep, {
      id: 'save',
      status: 'running',
      title: 'Saving Report',
      message: `Saving medical report for ${member.name}...`,
    });

    const result = await query(
      `INSERT INTO medical_reports
        (member_id, report_type, report_sub_type, title, description, file_path, file_name, file_size, report_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, member_id, report_type, report_sub_type, title, report_date`,
      [
        member.id,
        proposal.reportType || 'lab_report',
        proposal.reportSubType || 'general_lab',
        title,
        'Uploaded via Life Vault AI agent',
        file.filename,
        file.originalname,
        file.size,
        reportDate,
      ]
    );
    savedRecord = { type: 'report', ...result.rows[0] };

    await emit(onStep, {
      id: 'save',
      status: 'done',
      title: 'Saving Report',
      message: `Report saved — dated ${reportDate}`,
      data: savedRecord,
    });

    if (vitals.length > 0) {
      await emit(onStep, {
        id: 'vitals_save',
        status: 'running',
        title: 'Saving Vitals',
        message: `Adding ${vitals.length} vital reading(s)...`,
      });

      for (const vital of vitals) {
        const vitalResult = await query(
          `INSERT INTO health_vitals (member_id, vital_type, value, unit, notes, recorded_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, vital_type, value, unit, recorded_at`,
          [member.id, vital.vitalType, vital.value, vital.unit, vital.notes, reportDate]
        );
        vitalsSaved.push({ ...vitalResult.rows[0], label: vital.label });
      }

      await emit(onStep, {
        id: 'vitals_save',
        status: 'done',
        title: 'Saving Vitals',
        message: `Added ${vitalsSaved.length} vital reading(s)`,
        data: { vitals: vitalsSaved },
      });
    }
  } else {
    await emit(onStep, {
      id: 'save',
      status: 'running',
      title: 'Saving Document',
      message: `Saving document for ${member.name}...`,
    });

    const result = await query(
      `INSERT INTO documents
        (member_id, title, description, file_path, file_name, file_size, upload_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, member_id, title, upload_date`,
      [
        member.id,
        title,
        'Uploaded via Life Vault AI agent',
        file.filename,
        file.originalname,
        file.size,
        reportDate,
      ]
    );
    savedRecord = { type: 'document', ...result.rows[0] };

    await emit(onStep, {
      id: 'save',
      status: 'done',
      title: 'Saving Document',
      message: `Document saved — dated ${reportDate}`,
      data: savedRecord,
    });
  }

  pendingAnalyses.delete(analysisId);

  return {
    member: { id: member.id, name: member.name },
    classification: { category, reportType: proposal.reportType },
    reportDate,
    savedRecord,
    vitalsSaved,
  };
};

module.exports = { analyzePdfAgent, confirmPdfAgent };
