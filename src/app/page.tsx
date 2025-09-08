"use client";

import React, { useState, useEffect, useRef } from "react";

type QueryResult = {
  answer?: string;
  snippets?: { text?: string; metadata?: any }[];
};

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const [query, setQuery] = useState("");
  const [querying, setQuerying] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [history, setHistory] = useState<{ q: string; answer?: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [showFileModal, setShowFileModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isReplacingFile, setIsReplacingFile] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [lastAskedQuestion, setLastAskedQuestion] = useState<string | null>(null);
  const [dataCleared, setDataCleared] = useState(false);

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

  // Initialize theme from localStorage
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('theme');
        if (stored === 'dark') setIsDarkMode(true);
        if (stored === 'light') setIsDarkMode(false);
      }
    } catch {}
  }, []);

  // Initialize upload state from localStorage
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && !dataCleared) {
        const storedReady = localStorage.getItem('uploadReady');
        const storedHistory = localStorage.getItem('queryHistory');
        const storedFileName = localStorage.getItem('uploadedFileName');
        const historyModified = localStorage.getItem('historyModified');
        
        if (storedReady === 'true') setReady(true);
        
        // Only restore history if it hasn't been modified (deleted)
        if (storedHistory && historyModified !== 'true') {
          const parsedHistory = JSON.parse(storedHistory);
          if (Array.isArray(parsedHistory)) {
            setHistory(parsedHistory);
          }
        }
        
        if (storedFileName) {
          setUploadedFileName(storedFileName);
        }
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
  }, [dataCleared]);

  // Save upload state to localStorage
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('uploadReady', ready.toString());
      }
    } catch {}
  }, [ready]);

  // Save uploaded file name to localStorage
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        if (uploadedFileName) {
          localStorage.setItem('uploadedFileName', uploadedFileName);
        } else {
          localStorage.removeItem('uploadedFileName');
        }
      }
    } catch {}
  }, [uploadedFileName]);

  // Save history to localStorage
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && history.length > 0) {
        localStorage.setItem('queryHistory', JSON.stringify(history));
      }
    } catch (error) {
      console.error('Error saving history to localStorage:', error);
    }
  }, [history]);

  // Save history on component unmount
  useEffect(() => {
    return () => {
      try {
        if (typeof window !== 'undefined' && history.length > 0) {
          localStorage.setItem('queryHistory', JSON.stringify(history));
        }
      } catch (error) {
        console.error('Error saving history on unmount:', error);
      }
    };
  }, [history]);

  async function handleUpload() {
    if (!file) {
      setUploadMsg("Please choose a CSV file first.");
      return;
    }
    setUploading(true);
    setUploadMsg("Reading CSV...");
    setError(null);

    try {
      const text = await file.text();
      setUploadMsg("Uploading and processing. This may take a bit...");
      const res = await fetch("/api/upload-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || JSON.stringify(data));
      }
      setUploadMsg("Upload complete. You're ready to query.");
      setReady(true);
      setUploadedFileName(file.name);
      setDataCleared(false);
      
      // Reset history modification flag for new upload
      try {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('historyModified');
        }
      } catch {}
    } catch (err: any) {
      setError("Upload failed: " + (err?.message || String(err)));
      setUploadMsg(null);
      setReady(false);
    } finally {
      setUploading(false);
    }
  }

  async function handleQuery() {
    if (!query.trim()) return;
    setQuerying(true);
    setError(null);
    setResult(null);
    setLastAskedQuestion(query); // Store the question being asked
    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? JSON.stringify(data));
      setResult({
        answer: data.answer ?? data.summary ?? "",
        snippets: data.snippets ?? [],
      });
      setHistory((h) => [{ q: query, answer: data.answer ?? "" }, ...h].slice(0, 20));
    } catch (err: any) {
      setError("Query failed: " + (err?.message || String(err)));
    } finally {
      setQuerying(false);
    }
  }

  async function clearUploadState() {
    setDeleting(true);
    setShowDeleteModal(false);
    
    try {
      // Call API to clear all database tables
      const res = await fetch("/api/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || "Failed to clear database");
      }
      
      // Clear local state
      setReady(false);
      setFile(null);
      setError(null);
      setResult(null);
      setQuery("");
      setHistory([]);
      setShowFileModal(false);
      setIsReplacingFile(false);
      setUploadedFileName(null);
      setLastAskedQuestion(null);
      setDataCleared(true);
      
      // Reset the file input element
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
      
      try {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('uploadReady');
          localStorage.removeItem('queryHistory');
          localStorage.removeItem('uploadedFileName');
          localStorage.removeItem('historyModified');
        }
      } catch {}
      
      
      setUploadMsg("All data cleared successfully");
      
      // Clear the success message after a short delay
      setTimeout(() => {
        setUploadMsg(null);
      }, 3000);
      
    } catch (err: any) {
      setError("Failed to clear data: " + (err?.message || String(err)));
    } finally {
      setDeleting(false);
    }
  }

  function deleteHistoryItem(index: number) {
    const newHistory = history.filter((_, i) => i !== index);
    setHistory(newHistory);
    
    // Update localStorage immediately
    try {
      if (typeof window !== 'undefined') {
        if (newHistory.length > 0) {
          localStorage.setItem('queryHistory', JSON.stringify(newHistory));
        } else {
          localStorage.removeItem('queryHistory');
        }
        // Mark that history has been modified
        localStorage.setItem('historyModified', 'true');
      }
    } catch (error) {
      console.error('Error updating localStorage after delete:', error);
    }
  }

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

      {/* Main Container */}
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Title */}
        <div className="text-center mb-12">
          <h1 style={{ fontFamily: "'IBM Plex Sans', sans-serif" }} className="text-6xl font-bold mb-3 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent animate-gradient">
            chat recall
          </h1>
          <p className={`text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            transform your conversations into searchable memories
          </p>
          <a 
            href="/instructions" 
            className={`inline-block mt-3 text-sm underline hover:no-underline transition-all duration-300 ${
              isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-500'
            }`}
          >
            Need help? View instructions
          </a>
        </div>

        {/* Upload + Query Box */}
        <div className={`${isDarkMode ? 'border-gray-700 bg-gray-800/60' : 'border-gray-200 bg-white'} rounded-2xl border-2 p-4 sm:p-5 transition-all`}> 
          <div className="flex items-center gap-3">
            {/* Upload button (plus -> spinner -> check) */}
            <div>
              <input
                id="file-input"
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  if (f) {
                    setShowFileModal(true);
                    setUploadMsg(null);
                    setError(null);
                  }
                }}
              />
              {uploading ? (
                <div
                  className={`${isDarkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'} inline-flex items-center justify-center w-11 h-11 rounded-xl`}
                  aria-label="Uploading"
                >
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              ) : ready ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsReplacingFile(false);
                      setShowFileModal(true);
                    }}
                    className={`inline-flex items-center justify-center w-11 h-11 rounded-xl transition-colors bg-green-100 text-green-600 hover:bg-green-200`}
                    aria-label="View or replace uploaded CSV"
                  >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(true)}
                    disabled={deleting}
                    className={`inline-flex items-center justify-center w-11 h-11 rounded-xl transition-colors ${
                      deleting 
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                        : 'bg-red-100 text-red-600 hover:bg-red-200'
                    }`}
                    aria-label="Clear upload and reset"
                  >
                    {deleting ? (
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </div>
              ) : (
                <label
                  htmlFor="file-input"
                  className={`inline-flex items-center justify-center w-11 h-11 rounded-xl cursor-pointer transition-colors ${
                    isDarkMode ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                  aria-label="Upload CSV"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </label>
              )}
            </div>

            {/* Input */}
            <div className="flex-1">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={!ready || querying}
                placeholder={ready ? 'Type your query...' : 'Upload a CSV to start asking questions'}
                className={`w-full px-4 py-3 text-base sm:text-lg rounded-xl border-0 outline-none ${
                  isDarkMode ? 'bg-transparent text-white placeholder-gray-400' : 'bg-transparent text-gray-900 placeholder-gray-500'
                }`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !querying) handleQuery();
                }}
                ref={inputRef}
              />
            </div>

            {/* Send */}
            <button
              onClick={handleQuery}
              disabled={!ready || querying || !query.trim()}
              className={`inline-flex items-center justify-center w-11 h-11 rounded-xl font-medium transition-all ${
                !ready || querying || !query.trim()
                  ? isDarkMode ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : isDarkMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
              aria-label="Send"
            >
              {querying ? (
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>

          {/* Helper text */}
          <div className="mt-3 min-h-[1.25rem]">
            {uploadMsg && (
              <div className={`${isDarkMode ? 'text-green-300' : 'text-green-700'} text-sm`}>
                {uploadMsg}
              </div>
            )}
            {error && (
              <div className={`${isDarkMode ? 'text-red-300' : 'text-red-700'} text-sm`}>
                {error}
              </div>
            )}
            {!ready && !uploading && !uploadMsg && !error && (
              <div className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'} text-sm`}>
                Upload a file first to unlock querying
              </div>
            )}
          </div>
        </div>

        {/* Answer */}
        {result && (
          <div className="mt-10 space-y-4">
            <div className={`${isDarkMode ? 'bg-blue-900/30 border-blue-700' : 'bg-blue-50 border-blue-200'} p-5 rounded-xl border`}>
              <h3 className={`${isDarkMode ? 'text-blue-300' : 'text-blue-800'} text-sm font-semibold mb-1`}>Your Question</h3>
              <p className={`${isDarkMode ? 'text-white' : 'text-gray-900'} text-base`}>{lastAskedQuestion || query}</p>
            </div>
            <div className={`${isDarkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-white border-gray-200'} p-5 rounded-xl border`}>
              <h3 className={`${isDarkMode ? 'text-white' : 'text-gray-900'} text-base font-semibold mb-2`}>Answer</h3>
              <p className={`${isDarkMode ? 'text-gray-200' : 'text-gray-700'} whitespace-pre-wrap`}>{result.answer}</p>
            </div>
          </div>
        )}

        {/* Recent Queries */}
        {history.length > 0 && (
          <div className="mt-12">
            <h3 className={`text-xl font-semibold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Recent Queries
            </h3>
            <div className="space-y-4">
              {history.slice(0, 5).map((h, i) => (
                <div
                  key={i}
                  className={`p-4 rounded-xl transition-all ${
                    isDarkMode ? 'bg-gray-800/50 hover:bg-gray-800 border border-gray-700' : 'bg-white hover:bg-gray-50 border border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => {
                        setQuery(h.q);
                        inputRef.current?.focus();
                        setExpandedIndex((prev) => (prev === i ? null : i));
                      }}
                    >
                      <p className={`font-medium mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{h.q}</p>
                      {expandedIndex === i ? (
                        <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'} text-sm whitespace-pre-wrap`}>{h.answer || ''}</p>
                      ) : (
                        <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} text-sm`}>{truncate(h.answer || '', 100)}</p>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteHistoryItem(i);
                      }}
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors bg-red-100 text-red-600 hover:bg-red-200 flex-shrink-0`}
                      aria-label="Delete query"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* File Modal */}
        {showFileModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowFileModal(false)}></div>
            <div className={`${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'} relative z-10 w-[92%] max-w-sm rounded-xl border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} p-4 shadow-xl`}>
              <div className="mb-3 text-sm">
                {isReplacingFile ? 'Replace file' : ready ? 'Current file' : 'Selected file'}
              </div>
              <button
                onClick={() => {
                  if (ready && !isReplacingFile) {
                    // If we're viewing the current file, clicking it should start replace mode
                    setIsReplacingFile(true);
                  }
                  const input = document.getElementById('file-input') as HTMLInputElement | null;
                  input?.click();
                }}
                className={`${isDarkMode ? 'bg-gray-700 hover:bg-gray-650 text-gray-100' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'} w-full truncate rounded-lg px-3 py-2 text-left transition`}
                title={isReplacingFile ? (file?.name || '') : (ready ? (uploadedFileName || '') : (file?.name || ''))}
              >
                {isReplacingFile ? (file?.name || 'No file selected') : (ready ? (uploadedFileName || 'No file uploaded') : (file?.name || 'No file selected'))}
              </button>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setShowFileModal(false);
                    setIsReplacingFile(false);
                    // Reset file input if we were just viewing
                    if (!isReplacingFile && ready) {
                      const fileInput = document.getElementById('file-input') as HTMLInputElement;
                      if (fileInput) fileInput.value = '';
                      setFile(null);
                    }
                  }}
                  className={`${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'} text-sm px-3 py-2`}
                >
                  Cancel
                </button>
                {isReplacingFile ? (
                  <button
                    onClick={async () => {
                      setShowFileModal(false);
                      setIsReplacingFile(false);
                      await handleUpload();
                    }}
                    disabled={!file || uploading}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                      !file || uploading
                        ? isDarkMode ? 'bg-green-900/30 text-green-400 cursor-not-allowed' : 'bg-green-100 text-green-600 cursor-not-allowed'
                        : 'bg-green-500 hover:bg-green-600 text-white'
                    }`}
                  >
                    {uploading && (
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    Upload and Process
                  </button>
                ) : ready ? (
                  <button
                    onClick={() => {
                      setIsReplacingFile(true);
                      const input = document.getElementById('file-input') as HTMLInputElement | null;
                      input?.click();
                    }}
                    className={`${isDarkMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'} text-sm px-3 py-2 rounded-lg font-medium`}
                  >
                    Replace
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      setShowFileModal(false);
                      await handleUpload();
                    }}
                    disabled={!file || uploading}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                      !file || uploading
                        ? isDarkMode ? 'bg-green-900/30 text-green-400 cursor-not-allowed' : 'bg-green-100 text-green-600 cursor-not-allowed'
                        : 'bg-green-500 hover:bg-green-600 text-white'
                    }`}
                  >
                    {uploading && (
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    Upload and Process
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => !deleting && setShowDeleteModal(false)}></div>
            <div className={`${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'} relative z-10 w-[92%] max-w-sm rounded-xl border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} p-6 shadow-xl`}>
              <div className="mb-4">
                <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Delete All Data
                </h3>
                <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  This will permanently delete all uploaded data. This action cannot be undone.
                </p>
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    deleting
                      ? isDarkMode ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : isDarkMode ? 'bg-gray-600 hover:bg-gray-500 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={clearUploadState}
                  disabled={deleting}
                  className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    deleting
                      ? 'bg-red-300 text-red-100 cursor-not-allowed'
                      : 'bg-red-500 hover:bg-red-600 text-white'
                  }`}
                >
                  {deleting && (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {deleting ? 'Deleting...' : 'Delete All Data'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function truncate(s: string, n = 200) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}