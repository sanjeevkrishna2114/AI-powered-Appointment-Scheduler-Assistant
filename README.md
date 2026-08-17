# AI-powered-Appointment-Scheduler-Assistant
OCR to enitity recog to normalization

## Known Limitations & Best Practices
- **Multi-Column Screenshots:** The pipeline assumes screenshots primarily contain single-column message content. Screenshots that include wide inbox sidebars or navigation panes alongside the reading pane may produce interleaved, garbled text due to raster-order OCR constraints. For best results, crop screenshots specifically to the message body.
