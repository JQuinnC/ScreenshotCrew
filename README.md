# ScreenshotCrew - GCP Cloud Run Deployment

[![Node.js CI](https://github.com/jadiagaurang/ScreenshotCrew/actions/workflows/node.js.yml/badge.svg)](https://github.com/jadiagaurang/ScreenshotCrew/actions/workflows/node.js.yml)
[![Docker Image CI](https://github.com/jadiagaurang/ScreenshotCrew/actions/workflows/docker-image.yml/badge.svg)](https://github.com/jadiagaurang/ScreenshotCrew/actions/workflows/docker-image.yml)

ScreenshotCrew is an open-source screenshot as a service using [Puppeteer headless browser](https://github.com/puppeteer/puppeteer). This deployment is configured for Google Cloud Platform with Cloud Run and Google Cloud Storage.

## Development Environment Details

### GCP Configuration
- **Project ID**: functions-440815
- **Region**: us-central1  
- **Services**: Cloud Run, Cloud Storage, Container Registry
- **Service Account**: screenshot-crew-sa@functions-440815.iam.gserviceaccount.com
- **Storage Bucket**: screenshot_crew_images (public read access)
- **Namespace**: Default Cloud Run namespace

### Current Version
- **Application Version**: 1.0.1-gcp
- **Node.js Version**: 18.18.0
- **Deployment Status**: Ready for deployment

## API Schema

### Input Schema

#### Image Capture (GET/POST)
```
Endpoint: /api/capture/image
Parameters:
- url (required): Target webpage URL
- width (optional): Screenshot width in pixels (default: 1440)
- height (optional): Screenshot height in pixels (default: 1024)
```

#### PDF Capture (GET/POST)  
```
Endpoint: /api/capture/pdf
Parameters:
- url (required): Target webpage URL
- pageSize (optional): PDF page size - A4, Letter, etc. (default: A4)
- width (optional): Custom width in pixels
- height (optional): Custom height in pixels
```

### Output Schema

#### Success Response
```json
{
  "screenshotPath": "https://storage.googleapis.com/screenshot_crew_images/[UUID].webp",
  "fileFormat": "image",
  "width": 1920,
  "height": 1080,
  "document": {
    "width": 1920,
    "height": 2400
  }
}
```

#### Error Response
```json
{
  "Status": "ERROR",
  "Message": "Error description"
}
```

### API Examples

#### cURL Examples
```bash
# Image capture
curl --location --request GET "https://[CLOUD_RUN_URL]/api/capture/image?width=1920&url=https://example.com"

curl --location --request POST "https://[CLOUD_RUN_URL]/api/capture/image" \
  --header "Content-Type: application/json" \
  --data-raw '{
    "width": 1920,
    "url": "https://example.com"
  }'

# PDF capture
curl --location --request GET "https://[CLOUD_RUN_URL]/api/capture/pdf?pageSize=A4&url=https://example.com"
```

## Functions

### Core Functions

#### 1. screenshotCapture (v1.0.1)
**Use Case**: Generate webpage screenshots  
**Parameters**: url, width, height  
**Output**: WebP image stored in GCS  
**Changes**: 
- v1.0.1: Migrated from AWS S3 to Google Cloud Storage
- v1.0.1: Disabled memcached caching for simplified deployment

#### 2. pdfCapture (v1.0.1)  
**Use Case**: Generate PDF from webpage  
**Parameters**: url, pageSize or width/height  
**Output**: PDF file stored in GCS  
**Changes**:
- v1.0.1: Migrated storage backend to Google Cloud Storage

#### 3. imageUpload (v1.0.1)
**Use Case**: Upload generated images to cloud storage  
**Parameters**: imagePath, fileName  
**Output**: Public GCS URL  
**Changes**:
- v1.0.1: Complete rewrite from AWS SDK to Google Cloud Storage SDK
- v1.0.1: Auto-generates public URLs for browser access

## Installation

### Local Development
```bash
npm install
npm run dev
```

### Production Deployment  
```bash
npm start
```

### Docker Container
```bash
docker build -t screenshot-crew .
docker run -p 8080:8080 screenshot-crew
```

### GCP Cloud Run (Recommended)
See `DEPLOYMENT_GUIDE.md` for complete deployment instructions.

## Change Log

### Project Changes

#### Version 1.0.1-gcp (2025-01-21)
- **BREAKING**: Migrated from AWS S3 to Google Cloud Storage  
- **BREAKING**: Removed memcached dependency and caching logic
- **Enhancement**: Added GCP-specific environment configuration
- **Enhancement**: Updated Dockerfile for Cloud Run compatibility
- **Enhancement**: Added comprehensive deployment documentation
- **Fix**: Updated Node.js to version 18 for better Cloud Run support

#### Version 1.0.1 (Original)
- Base ScreenshotCrew functionality with AWS integration

### Function-Level Changes

#### screenshotCapture Function
- **v1.0.1**: Migrated storage from AWS S3 to Google Cloud Storage
- **v1.0.1**: Removed caching logic for simplified architecture  
- **v1.0.1**: Updated response format to include GCS public URLs

#### pdfCapture Function  
- **v1.0.1**: Updated storage backend to Google Cloud Storage
- **v1.0.1**: Maintained all PDF generation capabilities with new storage

#### imageUpload Function
- **v1.0.1**: Complete rewrite using @google-cloud/storage SDK
- **v1.0.1**: Automatic public URL generation for direct browser access
- **v1.0.1**: Enhanced error handling for GCS operations

## Testing

```bash
npm test
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## GCP Deployment Status

- ✅ Infrastructure: Ready for setup
- ✅ Code Modifications: Documented  
- ✅ Docker Configuration: Prepared
- ✅ GitHub Actions: Template ready
- ⏳ Deployment: Awaiting approval

**Next Steps**: Follow `DEPLOYMENT_GUIDE.md` to deploy to Cloud Run.
