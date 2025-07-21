# ScreenshotCrew GCP Cloud Run Deployment Guide

## Overview
This guide covers deploying ScreenshotCrew to Google Cloud Platform using Cloud Run, with screenshots stored in Google Cloud Storage.

**Target Configuration:**
- **GCP Project**: functions-440815
- **Region**: us-central1
- **Storage**: screenshot_crew_images bucket (public access)
- **Scaling**: 0-1 instances, 10 concurrent requests
- **Access**: Self-hosted N8N via API calls

## Prerequisites
- GCP CLI installed and authenticated
- Git repository access
- Docker installed locally (for testing)

## Step 1: GCP Infrastructure Setup

### 1.1 Enable Required APIs
```bash
gcloud config set project functions-440815

# Enable required services
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable storage.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

### 1.2 Create Service Account
```bash
# Create service account
gcloud iam service-accounts create screenshot-crew-sa \
    --description="Service account for ScreenshotCrew application" \
    --display-name="ScreenshotCrew Service Account"

# Grant necessary permissions
gcloud projects add-iam-policy-binding functions-440815 \
    --member="serviceAccount:screenshot-crew-sa@functions-440815.iam.gserviceaccount.com" \
    --role="roles/storage.objectAdmin"

gcloud projects add-iam-policy-binding functions-440815 \
    --member="serviceAccount:screenshot-crew-sa@functions-440815.iam.gserviceaccount.com" \
    --role="roles/storage.legacyBucketReader"
```

### 1.3 Create Cloud Storage Bucket
```bash
# Create the bucket
gsutil mb -p functions-440815 -l us-central1 gs://screenshot_crew_images

# Set public access for all users to read objects
gsutil iam ch allUsers:objectViewer gs://screenshot_crew_images

# Verify bucket configuration
gsutil ls -L gs://screenshot_crew_images
```

### 1.4 Create Service Account Key (for GitHub Actions)
```bash
# Generate service account key
gcloud iam service-accounts keys create ./screenshot-crew-key.json \
    --iam-account=screenshot-crew-sa@functions-440815.iam.gserviceaccount.com

# The key will be used in GitHub Actions - keep it secure
```

## Step 2: Code Modifications

### 2.1 Update Dependencies
- Replace `aws-sdk` with `@google-cloud/storage`
- Remove `memcached` dependency (caching disabled)
- Update Node.js version to 18 in Dockerfile

### 2.2 Environment Configuration
Update `config/prod.env`:
```env
PORT=8080
APP_SERVER="https://screenshot-crew-[HASH]-uc.a.run.app"
LOG_LEVEL=info
GCP_PROJECT_ID=functions-440815
GCS_BUCKET_NAME=screenshot_crew_images
SERVER_MEMCACHE_HOST=""
SERVER_MEMCACHE_PORT=""
```

### 2.3 Core Logic Changes
- Replace AWS S3 upload logic with Google Cloud Storage
- Disable memcached caching
- Update screenshot URL generation for GCS public URLs

## Step 3: Docker Configuration

### 3.1 Update Dockerfile
- Change base image to Node.js 18
- Install Chrome dependencies for Puppeteer
- Set proper port (8080 for Cloud Run)

### 3.2 Cloud Run Deployment Specs
- Memory: 1GB (minimum for Puppeteer)
- CPU: 1
- Max instances: 1
- Min instances: 0
- Concurrency: 10
- Timeout: 300 seconds (for screenshot processing)

## Step 4: GitHub Actions Setup

### 4.1 GitHub Secrets Configuration
Add these secrets to your GitHub repository:
- `GCP_PROJECT_ID`: functions-440815
- `GCP_SA_KEY`: Contents of screenshot-crew-key.json (base64 encoded)
- `GCP_REGION`: us-central1

### 4.2 Workflow File
Create `.github/workflows/deploy-cloud-run.yml` with:
- Build Docker image
- Push to Google Container Registry
- Deploy to Cloud Run with proper configuration

## Step 5: Testing and Validation

### 5.1 API Endpoints
- `GET/POST /api/capture/image?url=https://example.com&width=1920`
- `GET/POST /api/capture/pdf?url=https://example.com&pageSize=A4`

### 5.2 Expected Response Format
```json
{
  "screenshotPath": "https://storage.googleapis.com/screenshot_crew_images/[UUID].webp",
  "fileFormat": "image",
  "width": 1920,
  "height": 1024,
  "document": {
    "width": 1920,
    "height": 2000
  }
}
```

## Step 6: N8N Integration

### 6.1 HTTP Request Node Configuration
- **Method**: POST
- **URL**: `https://[CLOUD_RUN_URL]/api/capture/image`
- **Headers**: `Content-Type: application/json`
- **Body**: 
```json
{
  "url": "https://example.com",
  "width": 1920,
  "height": 1080
}
```

### 6.2 Response Processing
The response will contain the `screenshotPath` with a direct public URL to the generated screenshot in Google Cloud Storage.

## Monitoring and Maintenance

### Logs
```bash
# View Cloud Run logs
gcloud logs read --log-filter="resource.type=cloud_run_revision"
```

### Scaling
```bash
# Update scaling configuration
gcloud run services update screenshot-crew \
    --region=us-central1 \
    --min-instances=0 \
    --max-instances=2
```

### Storage Management
```bash
# List objects in bucket
gsutil ls gs://screenshot_crew_images/

# Clean up old screenshots (if needed later)
gsutil -m rm gs://screenshot_crew_images/screenshots-older-than-30-days/**
```

## Security Considerations

1. **Service Account**: Limited to necessary GCS permissions only
2. **Public Bucket**: Objects are publicly readable (as required)
3. **No Authentication**: API endpoints are public (internal use only)
4. **Network**: Cloud Run allows all ingress (required for N8N access)

## Troubleshooting

### Common Issues
1. **Puppeteer Chrome Issues**: Ensure proper Chrome dependencies in Dockerfile
2. **Memory Limits**: Screenshots may require more than default memory
3. **Timeout**: Large pages may exceed default timeout limits
4. **Permissions**: Verify service account has proper GCS permissions

### Debug Commands
```bash
# Test locally
docker build -t screenshot-crew .
docker run -p 8080:8080 -e GCP_PROJECT_ID=functions-440815 screenshot-crew

# Check Cloud Run service
gcloud run services describe screenshot-crew --region=us-central1
```

This guide provides a complete deployment path from source code to production Cloud Run service. 