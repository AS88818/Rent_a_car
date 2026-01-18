import { useState, useEffect } from 'react';
import { Upload, FileText, X, Download, Trash2 } from 'lucide-react';
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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
    const file = e.target.files?.[0];
    if (file) {
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        showToast('File size must be less than 10MB', 'error');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !bookingId) return;

    try {
      setUploading(true);
      await bookingDocumentService.uploadDocument(bookingId, selectedFile, documentType, notes);
      showToast('Document uploaded successfully', 'success');
      setSelectedFile(null);
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
              <span className="sr-only">Choose file</span>
              <input
                type="file"
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
            {selectedFile && (
              <p className="mt-2 text-sm text-gray-600">
                Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
              </p>
            )}
          </div>

          {selectedFile && (
            <div className="space-y-3">
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
                  placeholder="Add any notes about this document..."
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
                  {uploading ? 'Uploading...' : 'Upload Document'}
                </button>
                <button
                  onClick={() => {
                    setSelectedFile(null);
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
            Supported formats: PDF, JPG, PNG, DOC, DOCX (Max 10MB)
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
                    <a
                      href={doc.document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </a>
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
