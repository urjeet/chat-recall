"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

export default function InstructionsPage() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Dark mode toggle
  const toggleDarkMode = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('theme', next ? 'dark' : 'light');
      }
    } catch {}
  };

  // Apply dark mode to document
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('theme');
        if (stored === 'dark') setIsDarkMode(true);
        if (stored === 'light') setIsDarkMode(false);
      }
    } catch {}
  }, []);

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
      {/* Dark Mode Toggle */}
      <button
        onClick={toggleDarkMode}
        className={`fixed top-6 left-6 z-50 p-3 rounded-full transition-all duration-300 ${
          isDarkMode 
            ? 'bg-yellow-400 hover:bg-yellow-500 text-gray-900' 
            : 'bg-gray-800 hover:bg-gray-700 text-white'
        }`}
        aria-label="Toggle dark mode"
      >
        {isDarkMode ? '☀️' : '🌙'}
      </button>

      {/* Back Button */}
      <Link
        href="/"
        className={`fixed top-6 right-6 z-50 px-4 py-2 rounded-full transition-all duration-300 ${
          isDarkMode 
            ? 'bg-gray-700 hover:bg-gray-600 text-white' 
            : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
        }`}
      >
        ← Back
      </Link>

      {/* Main Container */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Title */}
        <div className="text-center mb-16">
          <h1 style={{ fontFamily: "'IBM Plex Sans', sans-serif" }} className="text-5xl font-bold mb-4 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent animate-gradient">
            instructions
          </h1>
          <p className={`text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            how to use chat recall effectively
          </p>
        </div>

        {/* Instructions Content */}
        <div className={`p-8 rounded-2xl transition-all duration-300 ${
          isDarkMode ? 'bg-gray-800/50' : 'bg-gray-50'
        }`}>
          <div className="prose prose-lg max-w-none">
            <h2 className={`text-2xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              iMessage Database Access Setup Guide
            </h2>
            
            <div className={`space-y-6 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
              <div>
                <h3 className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  1. Grant Full Disk Access
                </h3>
                <p className="mb-3">
                  To access your iMessage database, you need to grant Full Disk Access to your terminal or IDE:
                </p>
                <ol className="list-decimal list-inside space-y-2 ml-4">
                  <li>Go to <strong>System Settings</strong> → <strong>Privacy & Security</strong> → <strong>Full Disk Access</strong></li>
                  <li>Click the lock icon to make changes (enter your password)</li>
                  <li>Click the "+" button to add an application</li>
                  <li>Navigate to <code className={`px-2 py-1 rounded text-sm ${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-800'}`}>/Applications/Utilities/Terminal.app</code> and add it</li>
                  <li>If using VS Code or another IDE, also add that application</li>
                  <li>Restart your terminal/IDE after adding permissions</li>
                </ol>
              </div>

              <div>
                <h3 className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  2. Verify Permissions
                </h3>
                <p className="mb-3">
                  Test if you have the correct permissions by running:
                </p>
                <div className={`p-4 rounded-lg font-mono text-sm ${isDarkMode ? 'bg-gray-900 border border-gray-700' : 'bg-gray-100 border border-gray-300'}`}>
                  <code>ls -la ~/Library/Messages/chat.db</code>
                </div>
                <p className="mt-2 text-sm">
                  If you see "Operation not permitted", Full Disk Access isn't configured correctly.
                </p>
              </div>

              <div>
                <h3 className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  3. Test Database Access
                </h3>
                <p className="mb-3">
                  Verify you can read from the iMessage database:
                </p>
                <div className={`p-4 rounded-lg font-mono text-sm ${isDarkMode ? 'bg-gray-900 border border-gray-700' : 'bg-gray-100 border border-gray-300'}`}>
                  <code>sqlite3 ~/Library/Messages/chat.db "SELECT COUNT(*) FROM message;"</code>
                </div>
                <p className="mt-2 text-sm">
                  This should return a number (your total message count) without errors.
                </p>
              </div>

              <div>
                <h3 className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  4. Run the Export Script
                </h3>
                <p className="mb-3">
                  Use the unified script to extract messages with contact names:
                </p>
                <div className={`p-4 rounded-lg font-mono text-sm ${isDarkMode ? 'bg-gray-900 border border-gray-700' : 'bg-gray-100 border border-gray-300'}`}>
                  <code>python3 scripts/get_imessages.py</code>
                </div>
                <p className="mt-2 text-sm">
                  This script will automatically:
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
                  <li>Extract messages from your iMessage database</li>
                  <li>Fetch contact names from your AddressBook</li>
                  <li>Match phone numbers to contact names</li>
                  <li>Generate <code className={`px-1 py-0.5 rounded text-xs ${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-800'}`}>imessages_[num_messages]_[timestamp].csv</code></li>
                </ul>
              </div>

              <div>
                <h3 className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  5. Upload Your Data
                </h3>
                <p className="mb-3">
                  Once the script completes, upload the generated CSV file to Chat Recall:
                </p>
                <ol className="list-decimal list-inside space-y-2 ml-4">
                  <li>Click the "Choose CSV File" button on the main page</li>
                  <li>Select <code className={`px-2 py-1 rounded text-sm ${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-800'}`}>imessages_[num_messages]_[timestamp].csv</code></li>
                  <li>Wait for the system to process and index your conversations</li>
                </ol>
              </div>

              <div>
                <h3 className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  6. Start Searching
                </h3>
                <p className="mb-3">
                  Once your data is processed, you can ask natural language questions like:
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
                  <li>"What was I talking about with John last week?"</li>
                  <li>"When did I mention going to the beach?"</li>
                  <li>"Who was I discussing the project with?"</li>
                  <li>"What happened on October 14th?"</li>
                  <li>"Find all messages about the vacation planning"</li>
                </ul>
              </div>

              <div className={`p-4 rounded-lg border-l-4 ${isDarkMode ? 'bg-yellow-900/20 border-yellow-500' : 'bg-yellow-50 border-yellow-400'}`}>
                <h4 className={`font-semibold mb-2 ${isDarkMode ? 'text-yellow-200' : 'text-yellow-800'}`}>
                  ⚠️ Important Notes
                </h4>
                <ul className={`text-sm space-y-1 ${isDarkMode ? 'text-yellow-100' : 'text-yellow-700'}`}>
                  <li>• Close the Messages app before running the script to avoid database locks</li>
                  <li>• The script extracts the most recent 1000 messages by default</li>
                  <li>• Contact names are automatically resolved from your AddressBook</li>
                  <li>• Your data stays on your device - nothing is sent to external servers</li>
                </ul>
              </div>

              <div>
                <h3 className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Troubleshooting
                </h3>
                <div className="overflow-x-auto">
                  <table className={`w-full text-sm ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                    <thead>
                      <tr className={`border-b ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}>
                        <th className="text-left py-2 pr-4">Issue</th>
                        <th className="text-left py-2">Solution</th>
                      </tr>
                    </thead>
                    <tbody className="space-y-2">
                      <tr className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                        <td className="py-2 pr-4 font-mono text-xs">"database is locked"</td>
                        <td className="py-2">Close Messages app first</td>
                      </tr>
                      <tr className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                        <td className="py-2 pr-4 font-mono text-xs">"Operation not permitted"</td>
                        <td className="py-2">Need Full Disk Access</td>
                      </tr>
                      <tr className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                        <td className="py-2 pr-4 font-mono text-xs">"No such table: message"</td>
                        <td className="py-2">Wrong database path or corrupted database</td>
                      </tr>
                      <tr>
                        <td className="py-2 pr-4 font-mono text-xs">Script not found</td>
                        <td className="py-2">Make sure you're in the correct directory</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Output Format
                </h3>
                <p className="mb-3">
                  The script creates <code className={`px-2 py-1 rounded text-sm ${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-800'}`}>imessages_[num_messages]_[timestamp].csv</code> with these columns:
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
                  <li><code className={`px-2 py-1 rounded text-xs ${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-800'}`}>contact_name</code> - Resolved contact name or "Me"</li>
                  <li><code className={`px-2 py-1 rounded text-xs ${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-800'}`}>phone_number</code> - The phone number or contact identifier</li>
                  <li><code className={`px-2 py-1 rounded text-xs ${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-800'}`}>is_from_me</code> - 1 if you sent the message, 0 if received</li>
                  <li><code className={`px-2 py-1 rounded text-xs ${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-800'}`}>date</code> - Timestamp of the message</li>
                  <li><code className={`px-2 py-1 rounded text-xs ${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-800'}`}>body</code> - The message content</li>
                  <li><code className={`px-2 py-1 rounded text-xs ${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-800'}`}>group_chat_name</code> - Name of group chat (if applicable)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
