const Joi = require('joi');

const authSchemas = {
  login: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'A valid email address is required',
      'any.required': 'Email is required',
    }),
    password: Joi.string().min(1).required().messages({
      'any.required': 'Password is required',
    }),
  }),

  sendOtp: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'A valid email address is required',
      'any.required': 'Email is required',
    }),
  }),

  validateClassCode: Joi.object({
    code: Joi.string().trim().min(2).max(30).required().messages({
      'any.required': 'Class code is required',
    }),
  }),

  validateStudentNumber: Joi.object({
    student_number: Joi.string().trim().required().messages({
      'any.required': 'Student number is required',
    }),
    section_id: Joi.number().optional().allow(null),
    semester_id: Joi.number().optional().allow(null),
  }),

  register: Joi.object({
    first_name: Joi.string().trim().min(1).max(50).required(),
    middle_name: Joi.string().trim().allow('', null).optional(),
    last_name: Joi.string().trim().min(1).max(50).required(),
    extension_name: Joi.string().trim().allow('', null).optional(),
    gender: Joi.string().allow('', null).optional(),
    civil_status: Joi.string().allow('', null).optional(),
    birthday: Joi.string().allow('', null).optional().custom((value, helpers) => {
      if (!value) return value;
      const d = new Date(value);
      if (isNaN(d.getTime())) return helpers.message('Invalid date format for birthday');
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (d > today) return helpers.message('Birthday cannot be in the future');
      if (d.getFullYear() < 1900) return helpers.message('Please enter a valid birthday');
      const age = today.getFullYear() - d.getFullYear();
      const m = today.getMonth() - d.getMonth();
      const exactAge = (m < 0 || (m === 0 && today.getDate() < d.getDate())) ? age - 1 : age;
      if (exactAge < 10) return helpers.message('You must be at least 10 years old');
      return value;
    }),
    sex: Joi.string().allow('', null).optional(),
    email: Joi.string().email().required().messages({
      'string.email': 'A valid email is required',
    }),
    password: Joi.string().min(6).required().messages({
      'string.min': 'Password must be at least 6 characters long',
    }),
    role_id: Joi.number().integer().optional(),
    student_number: Joi.string().trim().allow('', null).optional(),
    class_code: Joi.string().trim().allow('', null).optional(),
    otp_code: Joi.string().trim().allow('', null).optional(),
    section_id: Joi.number().integer().allow(null).optional(),
    course_id: Joi.number().integer().allow(null).optional(),
    year_level: Joi.number().integer().allow(null).optional(),
    semester_id: Joi.number().integer().allow(null).optional(),
  }),

  changePassword: Joi.object({
    oldPassword: Joi.string().optional(),
    current_password: Joi.string().optional(),
    newPassword: Joi.string().min(6).optional(),
    new_password: Joi.string().min(6).optional(),
  }),
};

const roomSchemas = {
  createRoom: Joi.object({
    room_name: Joi.string().trim().min(2).max(100).required(),
    max_players: Joi.number().integer().min(1).max(100).optional(),
  }),

  joinRoom: Joi.object({
    room_code: Joi.string().trim().required().messages({
      'any.required': 'Room code is required',
    }),
  }),

  activateGame: Joi.object({
    room_id: Joi.number().integer().required(),
    case_id: Joi.number().integer().required(),
    difficulty_id: Joi.number().integer().required(),
    duration_minutes: Joi.number().integer().min(1).optional(),
    personal_time_limit: Joi.number().integer().min(0).optional(),
  }),
};

const practiceSchemas = {
  submitQuery: Joi.object({
    query: Joi.string().trim().min(1).required().messages({
      'any.required': 'SQL query cannot be empty',
    }),
    case_id: Joi.number().integer().optional(),
  }),
};

module.exports = {
  authSchemas,
  roomSchemas,
  practiceSchemas,
};
