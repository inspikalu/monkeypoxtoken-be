import { Request, Response, NextFunction } from 'express';
import axios from 'axios';

interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

export const validateTokenMetadata = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { uri } = req.body;

    if (!uri) {
      const error = new Error('URI is required');
      error.name = 'ValidationError';
      return next(error);
    }

    // Fetch metadata from the URI
    const response = await axios.get(uri);
    const metadata: NFTMetadata = response.data;

    const errors: string[] = [];

    // Required fields validation
    if (!metadata.name) {
      errors.push('Metadata must include a name');
    }

    if (!metadata.description) {
      errors.push('Metadata must include a description');
    }

    if (!metadata.image) {
      errors.push('Metadata must include an image URL');
    }

    // Name validation
    if (metadata.name && (metadata.name.length < 1 || metadata.name.length > 50)) {
      errors.push('Name must be between 1 and 50 characters');
    }

    // Description validation
    if (metadata.description && metadata.description.length > 1000) {
      errors.push('Description must not exceed 1000 characters');
    }

    // Image URL validation
    if (metadata.image) {
      try {
        const imageResponse = await axios.head(metadata.image);
        const contentType = imageResponse.headers['content-type'];
        if (!contentType?.startsWith('image/')) {
          errors.push('Image URL must point to a valid image file');
        }
      } catch (error) {
        errors.push('Image URL is not accessible');
      }
    }

    // Attributes validation (if present)
    if (metadata.attributes) {
      if (!Array.isArray(metadata.attributes)) {
        errors.push('Attributes must be an array');
      } else {
        metadata.attributes.forEach((attr, index) => {
          if (!attr.trait_type || !attr.value) {
            errors.push(`Attribute at index ${index} must have trait_type and value`);
          }
          if (typeof attr.trait_type !== 'string') {
            errors.push(`Attribute trait_type at index ${index} must be a string`);
          }
          if (typeof attr.value !== 'string' && typeof attr.value !== 'number') {
            errors.push(`Attribute value at index ${index} must be a string or number`);
          }
        });
      }
    }

    if (errors.length > 0) {
      const error = new Error(errors.join(', '));
      error.name = 'ValidationError';
      return next(error);
    }

    // Add validated metadata to request for use in subsequent middleware/controllers
    req.body.metadata = metadata;
    next();
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const customError = new Error('Failed to fetch metadata from URI');
      customError.name = 'ValidationError';
      return next(customError);
    }
    next(error);
  }
};