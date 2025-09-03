"use client"

interface DebugData {
  prompt: string
  response: string
}

interface DebugPopupProps {
  isOpen: boolean
  onClose: () => void
  debugData: DebugData | null
  messageId?: string | null
}

export function DebugPopup({ isOpen, onClose, debugData, messageId }: DebugPopupProps) {
  if (!isOpen) return null

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text)
    // You could add a toast notification here
    console.log(`${type} copied to clipboard`)
  }

  const formatJson = (jsonString: string) => {
    try {
      return JSON.stringify(JSON.parse(jsonString), null, 2)
    } catch {
      return jsonString
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            LLM Debug Data {messageId && `(Message: ${messageId})`}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-bold"
          >
            ×
          </button>
        </div>
        
        <div className="flex-1 overflow-auto p-4 space-y-6">
          {debugData ? (
            <>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-md font-medium text-gray-800">LLM Prompt</h3>
                  <button
                    onClick={() => copyToClipboard(debugData.prompt, 'Prompt')}
                    className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 px-2 py-1 rounded"
                  >
                    Copy Prompt
                  </button>
                </div>
                <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-64 border text-gray-800">
                  <code className="text-gray-800">{formatJson(debugData.prompt)}</code>
                </pre>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-md font-medium text-gray-800">LLM Response</h3>
                  <button
                    onClick={() => copyToClipboard(debugData.response, 'Response')}
                    className="text-xs bg-green-100 hover:bg-green-200 text-green-800 px-2 py-1 rounded"
                  >
                    Copy Response
                  </button>
                </div>
                <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-64 border text-gray-800">
                  <code className="text-gray-800">{formatJson(debugData.response)}</code>
                </pre>
              </div>
            </>
          ) : (
            <div className="text-center text-gray-500 py-8">
              No debug data available for this message
            </div>
          )}
        </div>
        
        <div className="border-t p-4 flex justify-end">
          <button
            onClick={onClose}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}