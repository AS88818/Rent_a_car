import { BarChart3, TrendingUp, Clock } from 'lucide-react';

export function ReportsPage() {
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Reports</h1>
        <p className="text-gray-600">
          Comprehensive reporting and analytics for your fleet management
        </p>
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl shadow-lg border border-blue-100 p-12">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-6">
            <BarChart3 className="w-10 h-10 text-blue-600" />
          </div>

          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Reports Coming Soon
          </h2>

          <p className="text-lg text-gray-600 mb-8">
            Advanced reporting features are currently in development. Soon you'll be able to generate detailed insights about your fleet operations.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <div className="flex items-start gap-3">
                <div className="bg-green-100 rounded-lg p-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Performance Analytics</h3>
                  <p className="text-sm text-gray-600">
                    Track revenue, utilization rates, and booking trends
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <div className="flex items-start gap-3">
                <div className="bg-blue-100 rounded-lg p-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Maintenance Reports</h3>
                  <p className="text-sm text-gray-600">
                    Analyze maintenance costs and vehicle downtime
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 text-sm text-gray-500">
            Check back soon for updates on this feature
          </div>
        </div>
      </div>
    </div>
  );
}
