const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { query } = require('../config/database');

const VITAL_PATTERNS = [
  { type: 'hemoglobin', labels: ['hemoglobin', 'haemoglobin', 'hb'], unit: 'g/dL', regex: /(?:hemoglobin|haemoglobin|\bhb\b)[:\s]*(\d+\.?\d*)/i },
  { type: 'cholesterol', labels: ['total cholesterol', 'cholesterol total'], unit: 'mg/dL', regex: /(?:total\s*cholesterol|cholesterol\s*\(total\))[:\s]*(\d+\.?\d*)/i },
  { type: 'sgpt', labels: ['sgpt', 'alt'], unit: 'U/L', regex: /(?:sgpt|\balt\b)[:\s]*(\d+\.?\d*)/i },
  { type: 'sgot', labels: ['sgot', 'ast'], unit: 'U/L', regex: /(?:sgot|\bast\b)[:\s]*(\d+\.?\d*)/i },
  { type: 'vitamin_d', labels: ['vitamin d', '25(oh)'], unit: 'ng/mL', regex: /(?:vitamin\s*d|25\s*\(?oh\)?)[:\s]*(\d+\.?\d*)/i },
  { type: 'thyroid_tsh', labels: ['tsh'], unit: 'μIU/mL', regex: /(?:\btsh\b|thyroid stimulating hormone)[:\s]*(\d+\.?\d*)/i },
  { type: 'thyroid_t3', labels: ['t3'], unit: 'ng/dL', regex: /(?:\bt3\b|triiodothyronine)[:\s]*(\d+\.?\d*)/i },
  { type: 'thyroid_t4', labels: ['t4'], unit: 'μg/dL', regex: /(?:\bt4\b|thyroxine)[:\s]*(\d+\.?\d*)/i },
  { type: 'vitamin_b12', labels: ['vitamin b12', 'b12'], unit: 'pg/mL', regex: /(?:vitamin\s*b\s*12|\bb12\b)[:\s]*(\d+\.?\d*)/i },
  { type: 'calcium', labels: ['calcium'], unit: 'mg/dL', regex: /(?:\bcalcium\b)[:\s]*(\d+\.?\d*)/i },
  { type: 'hba1c', labels: ['hba1c', 'hb a1c'], unit: '%', regex: /(?:hba1c|hb\s*a1c|glycated hemoglobin)[:\s]*(\d+\.?\d*)/i },
  { type: 'urea', labels: ['urea', 'blood urea'], unit: 'mg/dL', regex: /(?:blood\s*urea|\burea\b)[:\s]*(\d+\.?\d*)/i },
  { type: 'fasting_blood_glucose', labels: ['fasting glucose', 'fbs', 'fbg'], unit: 'mg/dL', regex: /(?:fasting\s*(?:blood\s*)?glucose|\bfbs\b|\bfbg\b)[:\s]*(\d+\.?\d*)/i },
  { type: 'creatinine', labels: ['creatinine'], unit: 'mg/dL', regex: /(?:\bcreatinine\b|serum creatinine)[:\s]*(\d+\.?\d*)/i },
];

const REPORT_KEYWORDS = [
  'lab report', 'pathology', 'biochemistry', 'hematology', 'blood test',
  'lipid profile', 'cbc', 'complete blood count', 'thyroid profile', 'hba1c',
  'diagnostic', 'reference range', 'test result', 'investigation', 'laboratory',
  'serum', 'plasma', 'mg/dl', 'g/dl', 'u/l', 'patient name', 'sample collected'
];

const DOCUMENT_KEYWORDS = [
  'insurance policy', 'policy document', 'certificate of', 'aadhaar', 'passport',
  'voter id', 'driving licence', 'driving license', 'birth certificate',
  'identity card', 'terms and conditions', 'agreement between'
];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const emit = async (onStep, step) => {
  onStep(step);
  await delay(120);
};

const normalizeText = (text) => text.replace(/\s+/g, ' ').trim();

const identifyMember = (text, members) => {
  const header = text.slice(0, 4000).toLowerCase();
  let best = null;
  let bestScore = 0;

  for (const member of members) {
    const fullName = member.name.toLowerCase();
    const parts = fullName.split(/\s+/).filter(Boolean);
    let score = 0;

    if (header.includes(fullName)) {
      score += 10;
    }

    for (const part of parts) {
      if (part.length > 2 && header.includes(part)) {
        score += 3;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = member;
    }
  }

  return bestScore >= 3 ? best : null;
};

const extractReportDate = (text) => {
  const patterns = [
    /(?:report\s*date|sample\s*(?:collected|collection)\s*(?:on|date)|collected\s*on|date\s*of\s*report|dated)[:\s]*(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/i,
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

  if (reportScore >= 2 && reportScore >= documentScore) {
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

  for (const pattern of VITAL_PATTERNS) {
    const match = text.match(pattern.regex);
    if (match && !seen.has(pattern.type)) {
      const value = parseFloat(match[1]);
      if (!Number.isNaN(value) && value > 0) {
        seen.add(pattern.type);
        vitals.push({
          vitalType: pattern.type,
          value,
          unit: pattern.unit,
          recordedAt: reportDate,
          notes: 'Auto-extracted from uploaded PDF by Life Vault agent',
        });
      }
    }
  }

  return vitals;
};

const processPdfAgent = async ({ file, user, onStep }) => {
  const uploadDir = process.env.UPLOAD_PATH || '/app/uploads';

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
    message: 'Reading PDF content...',
  });

  const filePath = path.join(uploadDir, file.filename);
  const buffer = fs.readFileSync(filePath);
  const pdfData = await pdfParse(buffer);
  const text = normalizeText(pdfData.text || '');

  if (!text || text.length < 20) {
    await emit(onStep, {
      id: 'extract',
      status: 'error',
      title: 'Extracting Text',
      message: 'Could not extract readable text from this PDF. Try a text-based PDF.',
    });
    throw new Error('Could not extract text from PDF');
  }

  await emit(onStep, {
    id: 'extract',
    status: 'done',
    title: 'Extracting Text',
    message: `Extracted ${text.length.toLocaleString()} characters`,
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

  const member = identifyMember(text, members);

  if (!member) {
    await emit(onStep, {
      id: 'members',
      status: 'error',
      title: 'Identifying Member',
      message: `Could not match PDF to any member. Family: ${members.map((m) => m.name).join(', ')}`,
    });
    throw new Error('Could not identify family member from PDF');
  }

  await emit(onStep, {
    id: 'members',
    status: 'done',
    title: 'Identifying Member',
    message: `Matched to ${member.name}`,
    data: { memberId: member.id, memberName: member.name },
  });

  await emit(onStep, {
    id: 'classify',
    status: 'running',
    title: 'Classifying Document',
    message: 'Determining if this is a medical report or general document...',
  });

  const classification = classifyContent(text);
  const reportDate = extractReportDate(text);
  const title = file.originalname.replace(/\.[^/.]+$/, '');

  await emit(onStep, {
    id: 'classify',
    status: 'done',
    title: 'Classifying Document',
    message: classification.category === 'report'
      ? `Medical report (${classification.reportType.replace(/_/g, ' ')})`
      : 'General document',
    data: { ...classification, reportDate },
  });

  let savedRecord = null;
  const vitalsSaved = [];

  if (classification.category === 'report') {
    await emit(onStep, {
      id: 'save',
      status: 'running',
      title: 'Saving Report',
      message: `Saving as medical report for ${member.name}...`,
    });

    const result = await query(
      `INSERT INTO medical_reports
        (member_id, report_type, report_sub_type, title, description, file_path, file_name, file_size, report_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, member_id, report_type, report_sub_type, title, report_date`,
      [
        member.id,
        classification.reportType,
        classification.reportSubType,
        title,
        'Auto-uploaded and classified by Life Vault agent',
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
      message: `Report saved with date ${reportDate}`,
      data: savedRecord,
    });

    await emit(onStep, {
      id: 'vitals',
      status: 'running',
      title: 'Extracting Vitals',
      message: 'Scanning report for lab values...',
    });

    const vitals = extractVitals(text, reportDate);

    if (vitals.length === 0) {
      await emit(onStep, {
        id: 'vitals',
        status: 'done',
        title: 'Extracting Vitals',
        message: 'No recognizable lab values found in this report',
        data: { vitals: [] },
      });
    } else {
      for (const vital of vitals) {
        const vitalResult = await query(
          `INSERT INTO health_vitals (member_id, vital_type, value, unit, notes, recorded_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, vital_type, value, unit, recorded_at`,
          [member.id, vital.vitalType, vital.value, vital.unit, vital.notes, vital.recordedAt]
        );
        vitalsSaved.push(vitalResult.rows[0]);
      }

      await emit(onStep, {
        id: 'vitals',
        status: 'done',
        title: 'Extracting Vitals',
        message: `Added ${vitalsSaved.length} vital reading${vitalsSaved.length === 1 ? '' : 's'} dated ${reportDate}`,
        data: { vitals: vitalsSaved },
      });
    }
  } else {
    await emit(onStep, {
      id: 'save',
      status: 'running',
      title: 'Saving Document',
      message: `Saving as document for ${member.name}...`,
    });

    const result = await query(
      `INSERT INTO documents
        (member_id, title, description, file_path, file_name, file_size, upload_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, member_id, title, upload_date`,
      [
        member.id,
        title,
        'Auto-uploaded and classified by Life Vault agent',
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
      message: `Document saved with date ${reportDate}`,
      data: savedRecord,
    });

    await emit(onStep, {
      id: 'vitals',
      status: 'skipped',
      title: 'Extracting Vitals',
      message: 'Skipped — not a lab report',
    });
  }

  return {
    member: { id: member.id, name: member.name },
    classification,
    reportDate,
    savedRecord,
    vitalsSaved,
  };
};

module.exports = { processPdfAgent };
