import { useState, useRef } from 'react';
import { Upload, X, CheckCircle, ImageIcon } from 'lucide-react';
import { imageService } from '../services/api';
import { VehicleImage } from '../types/database';
import { showToast } from '../lib/toast';

interface ImageUploadProps {
  vehicleId: string;
  images: VehicleImage[];
  onImageUploaded: (image: VehicleImage) => void;
  onImageDeleted: (imageId: string) => void;
  onPrimaryChanged: (imageId: string) => void;
}

export function ImageUpload({
  vehicleId,
  images,
  onImageUploaded,
  onImageDeleted,
  onPrimaryChanged
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxImages = 2;
  const maxFileSize = 4 * 1024 * 1024;
  const canUpload = images.length < maxImages;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (!canUpload) {
      showToast('Maximum 2 images allowed per vehicle', 'error');
      return;
    }

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    if (file.size > maxFileSize) {
      showToast('File size must be 4MB or less', 'error');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      showToast('Only JPEG, PNG, and WebP images are allowed', 'error');
      return;
    }

    setUploading(true);
    try {
      const newImage = await imageService.uploadVehicleImage(vehicleId, file);
      onImageUploaded(newImage);
      showToast('Image uploaded successfully', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to upload image', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (imageId: string) => {
    if (!confirm('Are you sure you want to delete this image?')) return;

    try {
      await imageService.deleteVehicleImage(imageId);
      onImageDeleted(imageId);
      showToast('Image deleted successfully', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to delete image', 'error');
    }
  };

  const handleSetPrimary = async (imageId: string) => {
    try {
      await imageService.setPrimaryImage(imageId, vehicleId);
      onPrimaryChanged(imageId);
      showToast('Primary image updated', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to update primary image', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Vehicle Images ({images.length}/{maxImages})
        </label>
        {images.length > 0 && (
          <span className="text-xs text-gray-500">
            Click on an image to set it as primary
          </span>
        )}
      </div>

      {canUpload && (
        <div
          className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
            dragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleFileInput}
            className="hidden"
            disabled={!canUpload || uploading}
          />

          <div className="text-center">
            {uploading ? (
              <>
                <Upload className="mx-auto h-12 w-12 text-gray-400 animate-pulse" />
                <p className="mt-2 text-sm text-gray-600">Uploading...</p>
              </>
            ) : (
              <>
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">
                  Drag and drop an image here, or{' '}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    browse
                  </button>
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  JPEG, PNG, or WebP up to 4MB
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {images.map((image) => (
            <div
              key={image.id}
              className={`relative group rounded-lg overflow-hidden border-2 ${
                image.is_primary ? 'border-blue-500' : 'border-gray-200'
              }`}
            >
              <button
                type="button"
                onClick={() => handleSetPrimary(image.id)}
                className="w-full"
              >
                <img
                  src={image.image_url}
                  alt="Vehicle"
                  className="w-full h-48 object-cover"
                />
              </button>

              <div className="absolute top-2 right-2 flex items-center gap-2">
                {image.is_primary && (
                  <div className="bg-blue-500 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Primary
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(image.id)}
                  className="bg-red-500 text-white p-1.5 rounded hover:bg-red-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {(image.file_size / 1024 / 1024).toFixed(2)} MB
              </div>
            </div>
          ))}
        </div>
      )}

      {images.length === 0 && !canUpload && (
        <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
          <ImageIcon className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-2 text-sm text-gray-500">No images uploaded</p>
        </div>
      )}
    </div>
  );
}
