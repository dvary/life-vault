import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import ProfilePicture from '../common/ProfilePicture';
import ProfilePictureUpload from '../common/ProfilePictureUpload';

// Vital types configuration with units and reference ranges
const VITAL_TYPES = {
  height: {
    label: 'Height',
    unit: 'cm',
    placeholder: '170',
    ranges: {
      normal: { min: 0, max: 200 },
      display: '0-200'
    }
  },
  weight: {
    label: 'Weight',
    unit: 'kg',
    placeholder: '70',
    ranges: {
      normal: { min: 0, max: 120 },
      display: '0-120'
    }
  },
  bmi: {
    label: 'BMI',
    unit: 'kg/m²',
    placeholder: '24.2',
    calculated: true,
    ranges: {
      underweight: { min: 0, max: 18.4 },
      normal: { min: 18.5, max: 24.9 },
      overweight: { min: 25, max: 29.9 },
      obese: { min: 30, max: 100 },
      display: '18.5-24.9'
    }
  },
  cholesterol: {
    label: 'Cholesterol',
    unit: 'mg/dL',
    placeholder: '200',
    ranges: {
      optimal: { min: 0, max: 199 },
      borderline: { min: 200, max: 239 },
      high: { min: 240, max: 500 },
      display: '<200'
    }
  },
  hemoglobin: {
    label: 'Hemoglobin',
    unit: 'g/dL',
    placeholder: '14',
    ranges: {
      male: { min: 13.8, max: 17.2 },
      female: { min: 12.1, max: 15.1 },
      display: 'M: 13.8-17.2, F: 12.1-15.1'
    }
  },
  sgpt: {
    label: 'S.G.P.T.',
    unit: 'U/L',
    placeholder: '40',
    ranges: {
      normal: { min: 7, max: 56 },
      display: '7-56'
    }
  },
  sgot: {
    label: 'S.G.O.T.',
    unit: 'U/L',
    placeholder: '40',
    ranges: {
      normal: { min: 10, max: 40 },
      display: '10-40'
    }
  },
  vitamin_d: {
    label: 'Vitamin D',
    unit: 'ng/mL',
    placeholder: '30',
    ranges: {
      deficient: { min: 0, max: 19 },
      insufficient: { min: 20, max: 29 },
      sufficient: { min: 30, max: 100 },
      display: '30-100'
    }
  },
  thyroid_tsh: {
    label: 'Thyroid TSH',
    unit: 'μIU/mL',
    placeholder: '2.5',
    ranges: {
      normal: { min: 0.27, max: 4.2 },
      display: '0.27-4.2'
    }
  },
  thyroid_t3: {
    label: 'Thyroid T3',
    unit: 'ng/dL',
    placeholder: '120',
    ranges: {
      normal: { min: 80, max: 200 },
      display: '80-200'
    }
  },
  thyroid_t4: {
    label: 'Thyroid T4',
    unit: 'μg/dL',
    placeholder: '1.2',
    ranges: {
      normal: { min: 5.1, max: 14.1 },
      display: '5.1-14.1'
    }
  },
  vitamin_b12: {
    label: 'Vitamin B12',
    unit: 'pg/mL',
    placeholder: '500',
    ranges: {
      deficient: { min: 0, max: 199 },
      low: { min: 200, max: 299 },
      normal: { min: 300, max: 900 },
      display: '300-900'
    }
  },
  calcium: {
    label: 'Calcium',
    unit: 'mg/dL',
    placeholder: '9.5',
    ranges: {
      normal: { min: 8.5, max: 10.2 },
      display: '8.5-10.2'
    }
  },
  hba1c: {
    label: 'HbA1c',
    unit: '%',
    placeholder: '5.7',
    ranges: {
      normal: { min: 0, max: 5.6 },
      prediabetic: { min: 5.7, max: 6.4 },
      diabetic: { min: 6.5, max: 15 },
      display: '<5.7'
    }
  },
  urea: {
    label: 'Urea',
    unit: 'mg/dL',
    placeholder: '20',
    ranges: {
      normal: { min: 6, max: 24 },
      display: '6-24'
    }
  },
  fasting_blood_glucose: {
    label: 'Fasting Blood Glucose',
    unit: 'mg/dL',
    placeholder: '100',
    ranges: {
      normal: { min: 70, max: 99 },
      prediabetic: { min: 100, max: 125 },
      diabetic: { min: 126, max: 300 },
      display: '70-99'
    }
  },
  creatinine: {
    label: 'Creatinine',
    unit: 'mg/dL',
    placeholder: '1.0',
    ranges: {
      normal: { min: 0.6, max: 1.4 },
      display: '0.6-1.4'
    }
  }
};

// Report types configuration
const REPORT_TYPES = {
  lab_report: {
    label: 'Lab Report',
    subTypes: [
      { value: 'blood_report', label: 'Blood Report' },
      { value: 'xray', label: 'X-Ray' },
      { value: 'stool_report', label: 'Stool Report' },
      { value: 'urine_report', label: 'Urine Report' },
      { value: 'ecg', label: 'ECG' },
      { value: 'ultrasound', label: 'Ultrasound' },
      { value: 'mri', label: 'MRI' },
      { value: 'ct_scan', label: 'CT Scan' },
      { value: 'general_lab', label: 'General Lab Report' }
    ]
  },
  prescription_consultation: {
    label: 'Prescription/Consultation',
    subTypes: [
      { value: 'prescription', label: 'Prescription' },
      { value: 'consultation', label: 'Consultation' },
      { value: 'follow_up', label: 'Follow-up' },
      { value: 'emergency_visit', label: 'Emergency Visit' }
    ]
  },
  vaccination: {
    label: 'Vaccination',
    subTypes: [
      { value: 'covid_19', label: 'COVID-19' },
      { value: 'flu', label: 'Flu Shot' },
      { value: 'hepatitis', label: 'Hepatitis' },
      { value: 'mmr', label: 'MMR' },
      { value: 'dtap', label: 'DTaP' },
      { value: 'other_vaccine', label: 'Other Vaccine' }
    ]
  },
  hospital_records: {
    label: 'Hospital Records',
    subTypes: [
      { value: 'admission', label: 'Admission Record' },
      { value: 'discharge', label: 'Discharge Summary' },
      { value: 'operation', label: 'Operation Report' },
      { value: 'emergency', label: 'Emergency Record' },
      { value: 'icu', label: 'ICU Record' },
      { value: 'general_hospital', label: 'General Hospital Record' }
    ]
  }
};

const Dashboard = () => {
  const { user, isAdmin } = useAuth();

  // Get current date components
  const getCurrentDateComponents = () => {
    const now = new Date();
    return {
      day: now.getDate().toString().padStart(2, '0'),
      month: (now.getMonth() + 1).toString().padStart(2, '0'),
      year: now.getFullYear().toString()
    };
  };
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [showAddVitalModal, setShowAddVitalModal] = useState(false);
  const [showUploadReportModal, setShowUploadReportModal] = useState(false);
  const [showUploadDocumentModal, setShowUploadDocumentModal] = useState(false);
  const [isSubmittingVital, setIsSubmittingVital] = useState(false);
  const [isSubmittingMember, setIsSubmittingMember] = useState(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [isSubmittingDocument, setIsSubmittingDocument] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    dateOfBirth: '',
    gender: '',
    bloodGroup: '',
    mobileNumber: '',
    email: '',
    password: '',
    role: 'user'
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    dateOfBirth: '',
    gender: '',
    bloodGroup: '',
    mobileNumber: '',
    email: '',
    password: '',
    role: 'user'
  });

  // Date component states
  const [dateComponents, setDateComponents] = useState(getCurrentDateComponents());
  const [editDateComponents, setEditDateComponents] = useState(getCurrentDateComponents());
  const [vitalFormData, setVitalFormData] = useState({
    vitalType: '',
    value: '',
    unit: '',
    notes: '',
    recordedAt: new Date().toISOString().split('T')[0]
  });
  const [reportFormData, setReportFormData] = useState({
    reportType: '',
    reportSubType: '',
    title: '',
    description: '',
    reportDate: new Date().toISOString().split('T')[0],
    file: null
  });

  const [documentFormData, setDocumentFormData] = useState({
    title: '',
    description: '',
    uploadDate: new Date().toISOString().split('T')[0],
    file: null
  });
  const [showProfileUploadModal, setShowProfileUploadModal] = useState(false);
  const [selectedMemberForProfile, setSelectedMemberForProfile] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchMembers();
  }, []);

  // Calculate age from date of birth with months for < 1 year
  const calculateAge = useCallback((dateOfBirth) => {
    if (!dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    const ageInMonths = (today.getFullYear() - birthDate.getFullYear()) * 12 +
      (today.getMonth() - birthDate.getMonth());

    if (ageInMonths < 12) {
      return { age: ageInMonths, unit: 'month', display: `${ageInMonths} Month${ageInMonths !== 1 ? 's' : ''} old` };
    } else {
      const years = Math.floor(ageInMonths / 12);
      const remainingMonths = ageInMonths % 12;
      if (remainingMonths === 0) {
        return { age: years, unit: 'year', display: `${years} Year${years !== 1 ? 's' : ''} old` };
      } else {
        return { age: years, unit: 'year', display: `${years} Year${years !== 1 ? 's' : ''} ${remainingMonths} Month${remainingMonths !== 1 ? 's' : ''} old` };
      }
    }
  }, []);

  // Get age group and color coding
  const getAgeGroupInfo = useCallback((ageData) => {
    if (ageData === null || ageData === undefined) return { group: 'Unknown', color: '#6B7280', bgColor: '#F3F4F6', icon: '👤' };

    const age = ageData.age;
    const unit = ageData.unit;

    // Calculate birth year based on age
    const currentYear = new Date().getFullYear();
    const birthYear = currentYear - age;

    if (unit === 'month' || (unit === 'year' && age < 18)) {
      if (birthYear >= 2013) {
        return { group: 'Generation Alpha', color: '#10B981', bgColor: '#D1FAE5', icon: '👶' };
      } else if (birthYear >= 1997) {
        return { group: 'Generation Z', color: '#3B82F6', bgColor: '#DBEAFE', icon: '👨‍🎓' };
      } else if (birthYear >= 1981) {
        return { group: 'Millennials', color: '#8B5CF6', bgColor: '#EDE9FE', icon: '👨‍💼' };
      } else if (birthYear >= 1965) {
        return { group: 'Generation X', color: '#F59E0B', bgColor: '#FEF3C7', icon: '👨‍🦳' };
      } else if (birthYear >= 1946) {
        return { group: 'Baby Boomers', color: '#EF4444', bgColor: '#FEE2E2', icon: '👴' };
      } else if (birthYear >= 1928) {
        return { group: 'Silent Generation', color: '#6B7280', bgColor: '#F3F4F6', icon: '👴' };
      } else if (birthYear >= 1901) {
        return { group: 'Greatest Generation', color: '#8B5CF6', bgColor: '#EDE9FE', icon: '👴' };
      } else {
        return { group: 'Lost Generation', color: '#6B7280', bgColor: '#F3F4F6', icon: '👴' };
      }
    } else {
      // For adults, use birth year directly
      if (birthYear >= 2013) {
        return { group: 'Generation Alpha', color: '#10B981', bgColor: '#D1FAE5', icon: '👶' };
      } else if (birthYear >= 1997) {
        return { group: 'Generation Z', color: '#3B82F6', bgColor: '#DBEAFE', icon: '👨‍🎓' };
      } else if (birthYear >= 1981) {
        return { group: 'Millennials', color: '#8B5CF6', bgColor: '#EDE9FE', icon: '👨‍💼' };
      } else if (birthYear >= 1965) {
        return { group: 'Generation X', color: '#F59E0B', bgColor: '#FEF3C7', icon: '👨‍🦳' };
      } else if (birthYear >= 1946) {
        return { group: 'Baby Boomers', color: '#EF4444', bgColor: '#FEE2E2', icon: '👴' };
      } else if (birthYear >= 1928) {
        return { group: 'Silent Generation', color: '#6B7280', bgColor: '#F3F4F6', icon: '👴' };
      } else if (birthYear >= 1901) {
        return { group: 'Greatest Generation', color: '#8B5CF6', bgColor: '#EDE9FE', icon: '👴' };
      } else {
        return { group: 'Lost Generation', color: '#6B7280', bgColor: '#F3F4F6', icon: '👴' };
      }
    }
  }, []);

  // Get gender icon
  const getGenderIcon = useCallback((gender) => {
    switch (gender) {
      case 'male':
        return '👨';
      case 'female':
        return '👩';
      case 'other':
        return '👤';
      default:
        return '👤';
    }
  }, []);

  // Date formatting utility
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Format date for HTML date input (yyyy-mm-dd)
  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Parse dd-mm-yyyy format to Date object
  const parseDateFromDisplay = (dateString) => {
    if (!dateString) return '';
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const day = parts[0];
      const month = parts[1];
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    return dateString;
  };

  // Generate date dropdown options (1-31)
  const generateDateOptions = () => {
    const options = [];
    for (let i = 1; i <= 31; i++) {
      options.push(
        <option key={i} value={i.toString().padStart(2, '0')}>
          {i}
        </option>
      );
    }
    return options;
  };

  // Generate month dropdown options
  const generateMonthOptions = () => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months.map((month, index) => (
      <option key={index + 1} value={(index + 1).toString().padStart(2, '0')}>
        {month}
      </option>
    ));
  };

  // Generate year dropdown options (1900 to current year)
  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const options = [];
    for (let year = currentYear; year >= 1900; year--) {
      options.push(
        <option key={year} value={year}>
          {year}
        </option>
      );
    }
    return options;
  };

  // Parse date components from date string
  const parseDateComponents = (dateString) => {
    if (!dateString) return { day: '', month: '', year: '' };
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return { day: '', month: '', year: '' };

    return {
      day: date.getDate().toString().padStart(2, '0'),
      month: (date.getMonth() + 1).toString().padStart(2, '0'),
      year: date.getFullYear().toString()
    };
  };

  // Combine date components into date string
  const combineDateComponents = (day, month, year) => {
    if (!day || !month || !year) return '';
    return `${year}-${month}-${day}`;
  };

  // Vital type change handler
  const handleVitalTypeChange = (vitalType) => {
    const vitalConfig = VITAL_TYPES[vitalType];
    setVitalFormData(prev => ({
      ...prev,
      vitalType,
      unit: vitalConfig ? vitalConfig.unit : '',
      value: ''
    }));
  };

  // File change handler
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    // Auto-fill title with filename (without extension) if title is empty
    const fileNameWithoutExt = file ? file.name.replace(/\.[^/.]+$/, '') : '';
    setReportFormData({
      ...reportFormData,
      file: file,
      title: reportFormData.title || fileNameWithoutExt
    });
  };

  // Group members by age group
  const groupMembersByAge = useCallback((members) => {
    const groups = {
      'Generation Alpha': [],
      'Generation Z': [],
      'Millennials': [],
      'Generation X': [],
      'Baby Boomers': [],
      'Silent Generation': [],
      'Greatest Generation': [],
      'Lost Generation': [],
      'Unknown': []
    };

    members.forEach(member => {
      const ageData = calculateAge(member.date_of_birth);
      const ageGroupInfo = getAgeGroupInfo(ageData);
      groups[ageGroupInfo.group].push({ ...member, ageData });
    });

    // Sort each group by age (descending)
    Object.keys(groups).forEach(group => {
      groups[group].sort((a, b) => {
        if (!a.ageData || !b.ageData) return 0;
        // Convert to months for comparison
        const aMonths = a.ageData.unit === 'month' ? a.ageData.age : a.ageData.age * 12;
        const bMonths = b.ageData.unit === 'month' ? b.ageData.age : b.ageData.age * 12;
        return bMonths - aMonths;
      });
    });

    return groups;
  }, [calculateAge, getAgeGroupInfo]);

  const fetchMembers = async () => {
    try {
      const response = await axios.get('/family/members');
      setMembers(response.data.members);
    } catch (error) {
      toast.error('Failed to fetch family members');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Prevent multiple submissions
    if (isSubmittingMember) {
      return;
    }

    // Frontend validation to match backend
    if (!editingMember) {
      // Validation for adding new member
      if (!formData.name || formData.name.trim() === '') {
        toast.error('Full Name is required');
        return;
      }
      if (!formData.gender || formData.gender === '') {
        toast.error('Gender is required');
        return;
      }
      if (!formData.email || formData.email.trim() === '') {
        toast.error('Email is required');
        return;
      }
      if (!formData.password || formData.password.length < 6) {
        toast.error('Password must be at least 6 characters long');
        return;
      }
      if (!formData.role || formData.role === '') {
        toast.error('Role is required');
        return;
      }

      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        toast.error('Please enter a valid email address');
        return;
      }

      // Mobile number validation (if provided)
      if (formData.mobileNumber && formData.mobileNumber.trim() !== '') {
        if (!/^\d{10}$/.test(formData.mobileNumber)) {
          toast.error('Mobile number must be exactly 10 digits');
          return;
        }
      }
    } else {
      // Validation for editing member
      if (!editFormData.name || editFormData.name.trim() === '') {
        toast.error('Full Name is required');
        return;
      }
      if (!editFormData.gender || editFormData.gender === '') {
        toast.error('Gender is required');
        return;
      }

      // Email format validation (if provided)
      if (editFormData.email && editFormData.email.trim() !== '') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(editFormData.email)) {
          toast.error('Please enter a valid email address');
          return;
        }
      }

      // Password validation (if provided)
      if (editFormData.password && editFormData.password.trim() !== '') {
        if (editFormData.password.length < 6) {
          toast.error('Password must be at least 6 characters long');
          return;
        }
      }

      // Mobile number validation (if provided)
      if (editFormData.mobileNumber && editFormData.mobileNumber.trim() !== '') {
        if (!/^\d{10}$/.test(editFormData.mobileNumber)) {
          toast.error('Mobile number must be exactly 10 digits');
          return;
        }
      }
    }

    setIsSubmittingMember(true);

    try {
      if (editingMember) {
        // For editing, use editFormData and only send non-empty fields
        const updateData = {};
        Object.keys(editFormData).forEach(key => {
          if (editFormData[key] !== '' && editFormData[key] !== null && editFormData[key] !== undefined) {
            updateData[key] = editFormData[key];
          }
        });

        await axios.put(`/family/members/${editingMember.id}`, updateData);
        toast.success('Family member updated successfully');
        setEditingMember(null);
        setEditFormData({ name: '', dateOfBirth: '', gender: '', email: '', password: '' });
      } else {
        if (members.length === 0) {
          await axios.post('/family/members/initial', {
            name: formData.name,
            dateOfBirth: formData.dateOfBirth,
            gender: formData.gender,
            email: formData.email,
            password: formData.password,
            role: formData.role
          });
          toast.success('Initial family member added successfully');
        } else {
          // Only send fields that have actual values (not empty strings)
          const memberData = {
            name: formData.name,
            gender: formData.gender,
            email: formData.email,
            password: formData.password,
            role: formData.role
          };

          // Add optional fields only if they have values
          if (formData.dateOfBirth && formData.dateOfBirth.trim() !== '') {
            memberData.dateOfBirth = formData.dateOfBirth;
          }
          if (formData.bloodGroup && formData.bloodGroup.trim() !== '') {
            memberData.bloodGroup = formData.bloodGroup;
          }
          if (formData.mobileNumber && formData.mobileNumber.trim() !== '') {
            memberData.mobileNumber = formData.mobileNumber;
          }

          await axios.post('/family/members', memberData);
          toast.success('Family member added successfully');
        }
        setShowAddForm(false);
      }
      setFormData({ name: '', dateOfBirth: '', gender: '', email: '', password: '' });
      fetchMembers();
    } catch (error) {
      const errorMessage = error.response?.data?.message ||
        (editingMember ? 'Failed to update family member' : 'Failed to add family member');
      toast.error(errorMessage);
    } finally {
      setIsSubmittingMember(false);
    }
  };

  const handleEditMember = (member) => {
    setEditingMember(member);
    setEditFormData({
      name: member.name || '',
      dateOfBirth: member.date_of_birth ? member.date_of_birth.split('T')[0] : '',
      gender: member.gender || '',
      bloodGroup: member.blood_group || '',
      mobileNumber: member.mobile_number || '',
      email: member.user_email || '',
      password: '', // Don't populate password for security
      role: member.role || 'non_admin'
    });

    // Populate date components for editing
    if (member.date_of_birth) {
      const components = parseDateComponents(member.date_of_birth);
      setEditDateComponents(components);
    } else {
      setEditDateComponents(getCurrentDateComponents());
    }
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingMember(null);
    setFormData({ name: '', dateOfBirth: '', gender: '', bloodGroup: '', mobileNumber: '', email: '', password: '', role: 'non_admin' });
    setEditFormData({ name: '', dateOfBirth: '', gender: '', bloodGroup: '', mobileNumber: '', email: '', password: '', role: 'non_admin' });
    setDateComponents(getCurrentDateComponents());
    setEditDateComponents(getCurrentDateComponents());
  };

  const handleMemberClick = (member) => {
    const memberName = member.name.toLowerCase().replace(/\s+/g, '-');
    navigate(`/${memberName}`);
  };

  const handleAddVitalFromDashboard = (member) => {
    setSelectedMember(member);
    setShowAddVitalModal(true);
  };

  const handleUploadReportFromDashboard = (member) => {
    setSelectedMember(member);
    setShowUploadReportModal(true);
  };

  const handleUploadDocumentFromDashboard = (member) => {
    setSelectedMember(member);
    setShowUploadDocumentModal(true);
  };

  const handleProfilePictureUpload = (member) => {
    setSelectedMemberForProfile(member);
    setShowProfileUploadModal(true);
  };

  const handleProfileUploadSuccess = (updatedMember) => {
    setMembers(prevMembers =>
      prevMembers.map(member =>
        member.id === updatedMember.id
          ? { ...member, profile_picture: updatedMember.profile_picture }
          : member
      )
    );
    // Update the editing member if it's the same one
    if (editingMember && editingMember.id === updatedMember.id) {
      setEditingMember(prev => ({
        ...prev,
        profile_picture: updatedMember.profile_picture
      }));
    }
  };

  const handleAddVital = async (e) => {
    e.preventDefault();

    // Prevent multiple submissions
    if (isSubmittingVital) {
      return;
    }

    setIsSubmittingVital(true);

    try {
      await axios.post('/health/vitals', {
        memberId: selectedMember.id,
        vitalType: vitalFormData.vitalType,
        value: parseFloat(vitalFormData.value),
        unit: vitalFormData.unit,
        notes: vitalFormData.notes,
        recordedAt: vitalFormData.recordedAt
      });
      toast.success('Health vital added successfully');
      setShowAddVitalModal(false);
      setSelectedMember(null);
      setVitalFormData({
        vitalType: '',
        value: '',
        unit: '',
        notes: '',
        recordedAt: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      if (error.response && error.response.status === 409) {
        toast.error('This vital has already been added recently. Please wait a moment before trying again.');
      } else {
        toast.error('Failed to add health vital');
      }
    } finally {
      setIsSubmittingVital(false);
    }
  };

  const handleUploadReport = async (e) => {
    e.preventDefault();

    // Prevent multiple submissions
    if (isSubmittingReport) {
      return;
    }

    setIsSubmittingReport(true);

    try {
      const formData = new FormData();
      formData.append('memberId', selectedMember.id);
      formData.append('reportType', reportFormData.reportType);
      formData.append('reportSubType', reportFormData.reportSubType || '');
      formData.append('title', reportFormData.title || reportFormData.file?.name?.replace(/\.[^/.]+$/, '') || '');
      formData.append('description', reportFormData.description);
      formData.append('reportDate', reportFormData.reportDate);
      formData.append('file', reportFormData.file);

      await axios.post('/health/reports', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      toast.success('Medical report uploaded successfully');
      setShowUploadReportModal(false);
      setSelectedMember(null);
      setReportFormData({
        reportType: '',
        reportSubType: '',
        title: '',
        description: '',
        reportDate: new Date().toISOString().split('T')[0],
        file: null
      });
    } catch (error) {
      toast.error('Failed to upload medical report');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleUploadDocument = async (e) => {
    e.preventDefault();

    // Prevent multiple submissions
    if (isSubmittingDocument) {
      return;
    }

    setIsSubmittingDocument(true);

    try {
      const formData = new FormData();
      formData.append('title', documentFormData.title);
      formData.append('description', documentFormData.description);
      formData.append('uploadDate', documentFormData.uploadDate);
      formData.append('file', documentFormData.file);

      await axios.post(`/health/documents/${selectedMember.id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      toast.success('Document uploaded successfully');
      setShowUploadDocumentModal(false);
      setSelectedMember(null);
      setDocumentFormData({
        title: '',
        description: '',
        uploadDate: new Date().toISOString().split('T')[0],
        file: null
      });
    } catch (error) {
      toast.error('Failed to upload document');
    } finally {
      setIsSubmittingDocument(false);
    }
  };



  const handleDeleteMember = async (memberId) => {
    if (window.confirm('Are you sure you want to delete this family member?')) {
      try {
        await axios.delete(`/family/members/${memberId}`);
        toast.success('Family member deleted successfully');
        fetchMembers();
        setEditingMember(null);
        setShowAddForm(false);
      } catch (error) {
        toast.error('Failed to delete family member');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  const groupedMembers = groupMembersByAge(members);
  const ageGroupOrder = ['Generation Alpha', 'Generation Z', 'Millennials', 'Generation X', 'Baby Boomers', 'Silent Generation', 'Greatest Generation', 'Lost Generation', 'Unknown'];

  return (
    <div className="relative z-10 w-full min-h-screen">
      <div className="p-1 sm:p-2 space-y-4">
        {/* Header */}
        {/* Hero Header Section */}
        <div className="glass-panel p-6 mb-8 relative overflow-hidden bg-gradient-to-r from-primary-500/10 to-secondary-500/10 border-primary-100/50">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-primary-500/10 blur-3xl"></div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center relative z-10 gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-800">
                Welcome back, {user?.firstName || 'User'}
              </h1>
            </div>

            {isAdmin() && (
              <button
                onClick={() => setShowAddForm(true)}
                className="btn-primary flex items-center space-x-2 shadow-lg hover:shadow-primary-500/30 transform hover:-translate-y-0.5 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Add Family Member</span>
              </button>
            )}
          </div>
        </div>

        {/* Add/Edit Form */}
        {(showAddForm || editingMember) && (
          <div className="glass-panel p-4 sm:p-6 mb-8 animate-fade-in">
            <h2 className="text-xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-secondary-600">
              {editingMember ? 'Edit Family Member' : 'Add Family Member'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Enter full name"
                    value={editingMember ? editFormData.name : formData.name}
                    onChange={(e) => editingMember
                      ? setEditFormData({ ...editFormData, name: e.target.value })
                      : setFormData({ ...formData, name: e.target.value })
                    }
                    className="glass-input w-full"
                    required
                  />
                </div>
                {/* Date of Birth Dropdowns */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Date of Birth (Optional)</label>
                  <div className="grid grid-cols-3 gap-2 sm:flex sm:space-x-2">
                    <select
                      value={editingMember ? editDateComponents.day : dateComponents.day}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (editingMember) {
                          const newComponents = { ...editDateComponents, day: value };
                          setEditDateComponents(newComponents);
                          const combinedDate = combineDateComponents(newComponents.day, newComponents.month, newComponents.year);
                          setEditFormData({ ...editFormData, dateOfBirth: combinedDate });
                        } else {
                          const newComponents = { ...dateComponents, day: value };
                          setDateComponents(newComponents);
                          const combinedDate = combineDateComponents(newComponents.day, newComponents.month, newComponents.year);
                          setFormData({ ...formData, dateOfBirth: combinedDate });
                        }
                      }}
                      className="glass-input w-full text-sm"
                    >
                      <option value="">Day</option>
                      {generateDateOptions()}
                    </select>

                    <select
                      value={editingMember ? editDateComponents.month : dateComponents.month}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (editingMember) {
                          const newComponents = { ...editDateComponents, month: value };
                          setEditDateComponents(newComponents);
                          const combinedDate = combineDateComponents(newComponents.day, newComponents.month, newComponents.year);
                          setEditFormData({ ...editFormData, dateOfBirth: combinedDate });
                        } else {
                          const newComponents = { ...dateComponents, month: value };
                          setDateComponents(newComponents);
                          const combinedDate = combineDateComponents(newComponents.day, newComponents.month, newComponents.year);
                          setFormData({ ...formData, dateOfBirth: combinedDate });
                        }
                      }}
                      className="glass-input w-full text-sm"
                    >
                      <option value="">Month</option>
                      {generateMonthOptions()}
                    </select>

                    <select
                      value={editingMember ? editDateComponents.year : dateComponents.year}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (editingMember) {
                          const newComponents = { ...editDateComponents, year: value };
                          setEditDateComponents(newComponents);
                          const combinedDate = combineDateComponents(newComponents.day, newComponents.month, newComponents.year);
                          setEditFormData({ ...editFormData, dateOfBirth: combinedDate });
                        } else {
                          const newComponents = { ...dateComponents, year: value };
                          setDateComponents(newComponents);
                          const combinedDate = combineDateComponents(newComponents.day, newComponents.month, newComponents.year);
                          setFormData({ ...formData, dateOfBirth: combinedDate });
                        }
                      }}
                      className="glass-input w-full text-sm"
                    >
                      <option value="">Year</option>
                      {generateYearOptions()}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gender <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={editingMember ? editFormData.gender : formData.gender}
                    onChange={(e) => editingMember
                      ? setEditFormData({ ...editFormData, gender: e.target.value })
                      : setFormData({ ...formData, gender: e.target.value })
                    }
                    className="glass-input w-full"
                    required
                  >
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Blood Group (Optional)
                  </label>
                  <select
                    value={editingMember ? editFormData.bloodGroup : formData.bloodGroup}
                    onChange={(e) => editingMember
                      ? setEditFormData({ ...editFormData, bloodGroup: e.target.value })
                      : setFormData({ ...formData, bloodGroup: e.target.value })
                    }
                    className="glass-input w-full"
                  >
                    <option value="">Select Blood Group</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mobile Number (Optional)
                  </label>
                  <input
                    type="tel"
                    placeholder="Enter 10-digit mobile number"
                    value={editingMember ? editFormData.mobileNumber : formData.mobileNumber}
                    onChange={(e) => {
                      // Only allow numeric input and limit to 10 digits
                      const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                      if (editingMember) {
                        setEditFormData({ ...editFormData, mobileNumber: value });
                      } else {
                        setFormData({ ...formData, mobileNumber: value });
                      }
                    }}
                    pattern="[0-9]{10}"
                    title="Please enter a 10-digit mobile number"
                    className="glass-input w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">Enter 10 digits only (e.g., 9876543210)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    placeholder="Enter email address"
                    value={editingMember ? editFormData.email : formData.email}
                    onChange={(e) => editingMember
                      ? setEditFormData({ ...editFormData, email: e.target.value })
                      : setFormData({ ...formData, email: e.target.value })
                    }
                    className="glass-input w-full"
                    required={!editingMember}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password {!editingMember && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="password"
                    placeholder={editingMember ? "New Password (leave blank to keep current)" : "Enter password"}
                    value={editingMember ? editFormData.password : formData.password}
                    onChange={(e) => editingMember
                      ? setEditFormData({ ...editFormData, password: e.target.value })
                      : setFormData({ ...formData, password: e.target.value })
                    }
                    className="glass-input w-full"
                    required={!editingMember}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={editingMember ? editFormData.role : formData.role}
                    onChange={(e) => editingMember
                      ? setEditFormData({ ...editFormData, role: e.target.value })
                      : setFormData({ ...formData, role: e.target.value })
                    }
                    className="glass-input w-full"
                    required
                  >
                    <option value="">Select Role</option>
                    <option value="non_admin">Family Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              {/* Profile Picture Upload Section - Only show when editing */}
              {editingMember && (
                <div className="border-t pt-4 mt-4">
                  <h3 className="text-md font-medium text-gray-900 mb-3">Profile Picture</h3>
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <ProfilePicture
                        member={editingMember}
                        size="lg"
                        showUploadButton={false}
                      />
                    </div>
                    <div className="flex-1">
                      <button
                        type="button"
                        onClick={() => handleProfilePictureUpload(editingMember)}
                        className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-medium text-sm"
                      >
                        Upload New Picture
                      </button>
                      <p className="text-xs text-gray-500 mt-1">
                        Supported formats: JPEG, PNG, GIF (max 15MB)
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={isSubmittingMember}
                  className={`btn-primary ${isSubmittingMember ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {isSubmittingMember ? (editingMember ? 'Updating...' : 'Adding...') : (editingMember ? 'Update Member' : 'Add Member')}
                </button>
                <button
                  type="button"
                  disabled={isSubmittingMember}
                  onClick={handleCancel}
                  className="btn-ghost"
                >
                  Cancel
                </button>
                {editingMember && (
                  <button
                    type="button"
                    onClick={() => handleDeleteMember(editingMember.id)}
                    className="btn bg-red-500 text-white hover:bg-red-600"
                  >
                    Delete Member
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* Family Members by Age Group */}
        {members.length > 0 ? (
          <div className="space-y-8">
            {ageGroupOrder.map(groupName => {
              const groupMembers = groupedMembers[groupName];
              if (!groupMembers || groupMembers.length === 0) return null;

              const ageGroupInfo = getAgeGroupInfo(groupMembers[0]?.ageData);

              return (
                <div key={groupName} className="space-y-4">
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <span className="text-xl sm:text-2xl">{ageGroupInfo.icon}</span>
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-900">{groupName}s</h2>
                    <span className="text-xs sm:text-sm text-gray-500">({groupMembers.length} member{groupMembers.length !== 1 ? 's' : ''})</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                    {groupMembers.map((member) => {
                      const ageData = member.ageData;
                      const ageGroupInfo = getAgeGroupInfo(ageData);
                      const genderIcon = getGenderIcon(member.gender);

                      return (
                        <div
                          key={member.id}
                          className="glass-card hover:scale-[1.02] p-4 cursor-pointer"
                          onClick={() => handleMemberClick(member)}
                        >
                          <div className="flex items-center space-x-4">
                            {/* Square Profile Picture on the Left */}
                            <div className="flex-shrink-0">
                              {member.profile_picture ? (
                                <img
                                  src={member.profile_picture}
                                  alt={`${member.name}'s profile`}
                                  className="w-16 h-16 rounded-lg object-cover border-2 border-gray-200"
                                />
                              ) : (
                                <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-blue-100 to-purple-100 border-2 border-gray-200 flex items-center justify-center">
                                  <span className="text-2xl text-gray-400">
                                    {member.gender === 'male' ? '👨' : member.gender === 'female' ? '👩' : '👤'}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Content on the Right */}
                            <div className="flex-1 min-w-0">
                              {/* Line 1: Name */}
                              <div className="font-bold text-gray-900 text-base sm:text-lg group-hover:text-primary-700 transition-colors truncate mb-1">
                                {member.name}
                              </div>

                              {/* Line 2: Age */}
                              <div className="text-xs text-gray-600 mb-1">
                                {member.date_of_birth ? calculateAge(member.date_of_birth)?.display || 'Age not specified' : 'Age not specified'}
                              </div>

                              {/* Line 3: Mobile Number */}
                              <div className="text-xs text-blue-600 mb-1">
                                📱 {member.mobile_number || 'No mobile'}
                              </div>

                              {/* Line 4: Blood Group */}
                              <div className="text-xs text-red-600">
                                🩸 {member.blood_group || 'No blood group'}
                              </div>
                            </div>

                            {/* Right side indicators */}
                            <div className="flex items-center space-x-2">
                              {/* Admin indicator */}
                              {member.role === 'admin' && (
                                <div className="flex-shrink-0 w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center">
                                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}

                              {/* Arrow indicator */}
                              <div className="flex-shrink-0 text-gray-400 group-hover:text-primary-500 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">👨‍👩‍👧‍👦</div>
            <h3 className="text-xl font-medium text-gray-900 mb-2">
              No family members yet
            </h3>
            <p className="text-gray-600 mb-6">
              Add your first family member to start building your Life Vault profile.
            </p>
            {isAdmin() && (
              <button
                onClick={() => setShowAddForm(true)}
                className="btn-primary px-6 py-3"
              >
                Add Family Member
              </button>
            )}
          </div>
        )}

        {/* Add Vital Modal */}
        {showAddVitalModal && selectedMember && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass-panel p-6 w-full max-w-md">
              <h2 className="text-lg font-semibold mb-4">Add Health Vital for {selectedMember.name}</h2>
              <form onSubmit={handleAddVital} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vital Type</label>
                  <select
                    value={vitalFormData.vitalType}
                    onChange={(e) => handleVitalTypeChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  >
                    <option value="">Select Vital Type</option>
                    {Object.entries(VITAL_TYPES).map(([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
                  <input
                    type="number"
                    step="0.01"
                    value={vitalFormData.value}
                    onChange={(e) => setVitalFormData({ ...vitalFormData, value: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder={vitalFormData.vitalType ? VITAL_TYPES[vitalFormData.vitalType]?.placeholder : ''}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <input
                    type="text"
                    value={vitalFormData.unit}
                    onChange={(e) => setVitalFormData({ ...vitalFormData, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder={vitalFormData.vitalType ? VITAL_TYPES[vitalFormData.vitalType]?.unit : ''}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date Recorded</label>
                  <input
                    type="text"
                    placeholder="dd-mm-yyyy"
                    value={vitalFormData.recordedAt ? formatDate(vitalFormData.recordedAt) : ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (/^[\d-]*$/.test(value)) {
                        setVitalFormData({ ...vitalFormData, recordedAt: parseDateFromDisplay(value) });
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Format: dd-mm-yyyy</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                  <textarea
                    value={vitalFormData.notes}
                    onChange={(e) => setVitalFormData({ ...vitalFormData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    rows="3"
                    placeholder="Any additional notes..."
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    type="submit"
                    disabled={isSubmittingVital}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${isSubmittingVital
                      ? 'bg-gray-400 cursor-not-allowed text-white'
                      : 'bg-teal-600 hover:bg-teal-700 text-white'
                      }`}
                  >
                    {isSubmittingVital ? 'Adding Vital...' : 'Add Vital'}
                  </button>
                  <button
                    type="button"
                    disabled={isSubmittingVital}
                    onClick={() => {
                      setShowAddVitalModal(false);
                      setSelectedMember(null);
                      setVitalFormData({
                        vitalType: '',
                        value: '',
                        unit: '',
                        notes: '',
                        recordedAt: new Date().toISOString().split('T')[0]
                      });
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${isSubmittingVital
                      ? 'bg-gray-400 cursor-not-allowed text-white'
                      : 'bg-gray-500 hover:bg-gray-600 text-white'
                      }`}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Upload Report Modal */}
        {showUploadReportModal && selectedMember && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass-panel p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-semibold mb-4">Upload Medical Report for {selectedMember.name}</h2>
              <form onSubmit={handleUploadReport} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
                  <select
                    value={reportFormData.reportType}
                    onChange={(e) => {
                      setReportFormData({
                        ...reportFormData,
                        reportType: e.target.value,
                        reportSubType: ''
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  >
                    <option value="">Select Report Type</option>
                    {Object.entries(REPORT_TYPES).map(([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Report Sub-Type <span className="text-red-500">*</span></label>
                  <select
                    value={reportFormData.reportSubType}
                    onChange={(e) => setReportFormData({ ...reportFormData, reportSubType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  >
                    <option value="">Select Sub-Type</option>
                    {reportFormData.reportType && REPORT_TYPES[reportFormData.reportType]?.subTypes ? (
                      REPORT_TYPES[reportFormData.reportType].subTypes.map((subType) => (
                        <option key={subType.value} value={subType.value}>{subType.label}</option>
                      ))
                    ) : (
                      Object.values(REPORT_TYPES).flatMap(config =>
                        config.subTypes ? config.subTypes.map((subType) => (
                          <option key={subType.value} value={subType.value}>{subType.label}</option>
                        )) : []
                      )
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">File Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={reportFormData.title}
                    onChange={(e) => setReportFormData({ ...reportFormData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder={reportFormData.file ? reportFormData.file.name.replace(/\.[^/.]+$/, '') : 'Enter file name'}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Name for this report (without extension)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Report Date</label>
                  <input
                    type="text"
                    placeholder="dd-mm-yyyy"
                    value={reportFormData.reportDate ? formatDate(reportFormData.reportDate) : ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (/^[\d-]*$/.test(value)) {
                        setReportFormData({ ...reportFormData, reportDate: parseDateFromDisplay(value) });
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Format: dd-mm-yyyy</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">File</label>
                  <input
                    type="file"
                    onChange={handleFileChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Accepted formats: PDF, DOC, DOCX, JPG, PNG, GIF (max 10MB)</p>
                </div>
                <div className="flex space-x-3">
                  <button
                    type="submit"
                    disabled={isSubmittingReport}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${isSubmittingReport
                      ? 'bg-gray-400 cursor-not-allowed text-white'
                      : 'bg-teal-600 hover:bg-teal-700 text-white'
                      }`}
                  >
                    {isSubmittingReport ? 'Uploading...' : 'Upload Report'}
                  </button>
                  <button
                    type="button"
                    disabled={isSubmittingReport}
                    onClick={() => {
                      setShowUploadReportModal(false);
                      setSelectedMember(null);
                      setReportFormData({
                        reportType: '',
                        reportSubType: '',
                        description: '',
                        reportDate: new Date().toISOString().split('T')[0],
                        file: null
                      });
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${isSubmittingReport
                      ? 'bg-gray-400 cursor-not-allowed text-white'
                      : 'bg-gray-500 hover:bg-gray-600 text-white'
                      }`}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Upload Document Modal */}
        {showUploadDocumentModal && selectedMember && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass-panel p-6 w-full max-w-md">
              <h2 className="text-lg font-semibold mb-4">Upload Document for {selectedMember.name}</h2>
              <form onSubmit={handleUploadDocument} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">File Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={documentFormData.title}
                    onChange={(e) => setDocumentFormData({ ...documentFormData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="File name (without extension)"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Name for this document (without extension)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Upload Date</label>
                  <input
                    type="text"
                    placeholder="dd-mm-yyyy"
                    value={documentFormData.uploadDate ? formatDate(documentFormData.uploadDate) : ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (/^[\d-]*$/.test(value)) {
                        setDocumentFormData({ ...documentFormData, uploadDate: parseDateFromDisplay(value) });
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Format: dd-mm-yyyy</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">File</label>
                  <input
                    type="file"
                    onChange={(e) => setDocumentFormData({ ...documentFormData, file: e.target.files[0] })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    accept=".pdf"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Only PDF files are accepted (max 10MB)</p>
                </div>
                <div className="flex space-x-3">
                  <button
                    type="submit"
                    disabled={isSubmittingDocument}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${isSubmittingDocument
                      ? 'bg-gray-400 cursor-not-allowed text-white'
                      : 'bg-teal-600 hover:bg-teal-700 text-white'
                      }`}
                  >
                    {isSubmittingDocument ? 'Uploading...' : 'Upload Document'}
                  </button>
                  <button
                    type="button"
                    disabled={isSubmittingDocument}
                    onClick={() => {
                      setShowUploadDocumentModal(false);
                      setSelectedMember(null);
                      setDocumentFormData({
                        title: '',
                        description: '',
                        uploadDate: new Date().toISOString().split('T')[0],
                        file: null
                      });
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${isSubmittingDocument
                      ? 'bg-gray-400 cursor-not-allowed text-white'
                      : 'bg-gray-500 hover:bg-gray-600 text-white'
                      }`}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Profile Picture Upload Modal */}
        {showProfileUploadModal && selectedMemberForProfile && (
          <ProfilePictureUpload
            member={selectedMemberForProfile}
            onUploadSuccess={handleProfileUploadSuccess}
            onClose={() => {
              setShowProfileUploadModal(false);
              setSelectedMemberForProfile(null);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default Dashboard;
