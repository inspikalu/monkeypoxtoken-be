import { Request, Response, NextFunction } from "express";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err.name === "ValidationError") {
    res.status(400).json({
      success: false,
      error: err.message,
    });
  } else {
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};
