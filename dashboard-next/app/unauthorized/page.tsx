export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Unauthorized</h1>
          <p className="text-gray-600 mb-4">Invalid or expired token. Access denied.</p>
          <p className="text-sm text-gray-500">
            Please return to WordPress and click "Open TrustHive Dashboard" again.
          </p>
        </div>
      </div>
    </div>
  );
}
