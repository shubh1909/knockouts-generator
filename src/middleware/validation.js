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
};

export const validate = (schema) => (req, res, next) => {
  const validationErrors = [];

  if (schema.body) {
    const { error } = schema.body.validate(req.body);
    if (error) {
      validationErrors.push({
        field: "body",
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

export { tournamentValidation };
