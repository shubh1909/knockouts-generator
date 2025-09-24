import Joi from "joi";

const tournamentValidation = {
  createTournamentWithPDF: {
    body: Joi.object({
      name: Joi.string().min(3).max(100).optional(),
      pdfTitle: Joi.string().min(1).max(100).optional(),
      date: Joi.string().optional(),
      country: Joi.string().min(1).max(50).optional(),
      website: Joi.string().uri().optional(),
      participants: Joi.array()
        .items(Joi.string().min(1).max(50))
        .min(2)
        .max(128)
        .required()
        .messages({
          "array.min": "At least 2 participants are required",
          "array.max": "Maximum 128 participants allowed",
        }),
      rounds: Joi.array()
        .items(Joi.array().items(Joi.string().min(1).max(50)))
        .optional()
        .default([]),
      returnType: Joi.string()
        .valid("json", "download", "url", "csv")
        .optional()
        .default("download"),
    }).options({ stripUnknown: true }),
  },
};

export const validate = (schema) => (req, res, next) => {
  try {
    if (schema.body) {
      const { error } = schema.body.validate(req.body, { abortEarly: false });
      if (error) {
        console.log("Validation Error:", error);
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: error.details.map((detail) => ({
            field: detail.path.join("."),
            message: detail.message,
          })),
        });
      }
    }

    next();
  } catch (err) {
    console.error("Validation middleware error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal validation error",
      error: err.message,
    });
  }
};

export { tournamentValidation };
