const Joi = require('joi');

/**
 * Express middleware helper to validate req[property] against a Joi schema.
 * If validation fails, returns 400 with a clean error message and array of validation errors.
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      allowUnknown: true,
      stripUnknown: false,
    });

    if (error) {
      const messages = error.details.map((d) => d.message.replace(/['"]/g, ''));
      return res.status(400).json({
        error: messages[0] || 'Invalid request data',
        validationErrors: messages,
      });
    }

    req[property] = value;
    next();
  };
};

module.exports = { validate };
