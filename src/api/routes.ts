import { Router, Request, Response } from 'express';
import multer from 'multer';
import { runPipeline, PipelineInput } from '../pipeline/graph';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/appointment', upload.single('image'), async (req: Request, res: Response): Promise<void> => {
  try {
    let input: PipelineInput;

    // Handle multipart form-data (image upload)
    if (req.file) {
      input = {
        type: 'image',
        payload: req.file.buffer
      };
    } 
    // Handle JSON text payload
    else if (req.body && req.body.type === 'text' && req.body.payload) {
      input = {
        type: 'text',
        payload: req.body.payload
      };
    } 
    // Invalid request
    else {
      res.status(400).json({
        status: 'needs_clarification',
        message: 'Invalid request. Provide either a JSON body { type: "text", payload: "..." } or multipart form-data with an "image" file.'
      });
      return;
    }

    const result = await runPipeline(input);
    res.json(result);
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error while processing the appointment'
    });
  }
});

export default router;
