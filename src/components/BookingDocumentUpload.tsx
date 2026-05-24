import { useState, useEffect } from 'react';
import { Upload, FileText, Download, Trash2, X } from 'lucide-react';
import { bookingDocumentService } from '../services/api';
import { BookingDocument } from '../types/database';
import { showToast } from '../lib/toast';

interface BookingDocumentUploadProps {
  bookingId?: string;
  onDocumentUploaded?: () => void;
}

export function BookingDocumentUpload({ bookingId, onDocumentUploaded }: BookingDocumentUploadProps) {
  const [documents, setDocuments] = useState<BookingDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [documentType, setDocumentType] = useState<string>('license');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (bookingId) {
      loadDocuments();
    }
  }, [bookingId]);

  const loadDocuments = async () => {
    if (!bookingId) return;

    try {
      setLoading(true);
      const data = await bookingDocumentService.getDocuments(bookingId);
      setDocuments(data || []);
    } catch (error: any) {
      showToast(error.message || 'Failed to load documents', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const maxSize = 10 * 1024 * 1024;
    const oversized = files.filter(f => f.size > maxSize);
    if (oversized.length > 0) {
      showToast(`${oversized.length} file(s) exceed 10MB and were skipped`, 'error');
    }
    const valid = files.filter(f => f.size <= maxSize);
    if (valid.length > 0) {
      setSelectedFiles(valid);
    }
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0 || !bookingId) return;

    try {
      setUploading(true);
      for (let i = 0; i < selectedFiles.length; i++) {
        setUploadProgress(`Uploading ${i + 1} of ${selectedFiles.length}...`);
        await bookingDocumentService.uploadDocument(bookingId, selectedFiles[i], documentType, notes);
      }
      showToast(
        selectedFiles.length === 1
          ? 'Document uploaded successfully'
          : `${selectedFiles.length} documents uploaded successfully`,
        'success'
      );
      setSelectedFiles([]);
      setNotes('');
      setDocumentType('license');
      await loadDocuments();
      if (onDocumentUploaded) {
        onDocumentUploaded();
      }
    } catch (error: any) {
      showToast(error.message || 'Failed to upload document', 'error');
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      await bookingDocumentService.deleteDocument(documentId);
      showToast('Document deleted successfully', 'success');
      await loadDocuments();
    } catch (error: any) {
      showToast(error.message || 'Failed to delete document', 'error');
    }
  };

  const handleDownload = async (documentId: string) => {
    try {
      const url = await bookingDocumentService.getSignedUrl(documentId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to open document', 'error');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      license: "Driver's License",
      contract: 'Signed Contract',
      id_document: 'ID Document',
      insurance: 'Insurance Document',
      other: 'Other Document',
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-center">
            <Upload className="w-10 h-10 text-gray-400" />
          </div>

          <div className="text-center">
            <label className="block">
              <span className="sr-only">Choose files</span>
              <input
                type="file"
                multiple
                onChange={handleFileSelect}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100
                  cursor-pointer"
              />
            </label>
          </div>

          {selectedFiles.length > 0 && (
            <div className="space-y-3">
              <div className="space-y-1">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 rounded px-3 py-1.5 text-sm">
                    <span className="text-gray-700 truncate">{file.name} <span className="text-gray-400">({formatFileSize(file.size)})</span></span>
                    <button
                      onClick={() => removeFile(index)}
                      className="ml-2 text-gray-400 hover:text-red-500 flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Document Type
                </label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="license">Driver's License</option>
                  <option value="contract">Signed Contract</option>
                  <option value="id_document">ID Document</option>
                  <option value="insurance">Insurance Document</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes about these documents..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Upload className="w-4 h-4" />
                  {uploading
                    ? uploadProgress
                    : selectedFiles.length === 1
                      ? 'Upload Document'
                      : `Upload ${selectedFiles.length} Documents`}
                </button>
                <button
                  onClick={() => {
                    setSelectedFiles([]);
                    setNotes('');
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <p className="text-xs text-gray-500 text-center">
            Supported formats: PDF, JPG, PNG, DOC, DOCX (Max 10MB per file)
          </p>
        </div>
      </div>

      {bookingId && (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900">Uploaded Documents</h3>
          {loading ? (
            <p className="text-gray-500 text-sm">Loading documents...</p>
          ) : documents.length === 0 ? (
            <p className="text-gray-500 text-sm">No documents uploaded yet</p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {doc.document_name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{getDocumentTypeLabel(doc.document_type)}</span>
                        <span>•</span>
                        <span>{formatFileSize(doc.file_size)}</span>
                        {doc.notes && (
                          <>
                            <span>•</span>
                            <span className="truncate">{doc.notes}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownload(doc.id)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
