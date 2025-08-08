import Joi from "joi";

const tournamentValidation = {
  createTournamentWithPDF: {
    body: Joi.object({
      name: Joi.string().min(3).max(100).optional(),
      pdfTitle: Joi.string().min(1).max(100).optional(),
      participants: Joi.array()
        .items(
          Joi.alternatives().try(
            Joi.string().min(1).max(50),
            Joi.object({
              id: Joi.number().integer().positive().optional(),
              name: Joi.string().min(1).max(50).required(),
            })
          )
        )
        .min(2)
        .max(128)
        .required()
        .messages({
          "array.min": "At least 2 participants are required",
          "array.max": "Maximum 128 participants allowed",
        }),
      returnType: Joi.string()
        .valid("json", "download", "url")
        .optional()
        .default("download"),
    }),
  },

  quickPDF: {
    body: Joi.object({
      name: Joi.string().min(3).max(100).optional(),
      pdfTitle: Joi.string().min(1).max(100).optional(),
      participants: Joi.array()
        .items(
          Joi.alternatives().try(
            Joi.string().min(1).max(50),
            Joi.object({
              id: Joi.number().integer().positive().optional(),
              name: Joi.string().min(1).max(50).required(),
            })
          )
        )
        .min(2)
        .max(128)
        .required()
        .messages({
          "array.min": "At least 2 participants are required",
          "array.max": "Maximum 128 participants allowed",
        }),
    }),
  },
};

export const validate = (schema) => {
  return (req, res, next) => {
    const validationErrors = [];

    // Validate request body
    if (schema.body) {
      const { error } = schema.body.validate(req.body);
      if (error) {
        validationErrors.push({
          field: "body",
          message: error.details[0].message,
        });
      }
    }

    // Validate request params
    if (schema.params) {
      const { error } = schema.params.validate(req.params);
      if (error) {
        validationErrors.push({
          field: "params",
          message: error.details[0].message,
        });
      }
    }

    // Validate request query
    if (schema.query) {
      const { error } = schema.query.validate(req.query);
      if (error) {
        validationErrors.push({
          field: "query",
          message: error.details[0].message,
        });
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationErrors,
      });
    }

    next();
  };
};

export { tournamentValidation };
