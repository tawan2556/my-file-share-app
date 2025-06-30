/* global __firebase_config:true __app_id:true __initial_auth_token:true */
import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';

// Lucide React for icons
import { FileText, Link, Trash2, Edit, Save, X, User, Upload } from 'lucide-react';

// Define Firebase config and app ID (provided by the environment)
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Define Categories
const CATEGORIES = [
  { value: 'urgent', label: 'งานด่วน' },
  { value: 'fc', label: 'งานFC' },
  { value: 'manager', label: 'งานผู้จัดการ' },
  { value: 'qssi_prep', label: 'งานเตรียมQSSI' },
  { value: 'general', label: 'งานทั่วไป' },
];

// Main App Component
function App() {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState('');
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [sharedItems, setSharedItems] = useState([]);
  const [newTextContent, setNewTextContent] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0].value); // New state for category
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [showNameInput, setShowNameInput] = useState(false); // State for showing name input
  const [activeTab, setActiveTab] = useState('text'); // 'text' or 'link' for tabs
  const [editUserName, setEditUserName] = useState(''); // State for editing user name

  // States for editing existing items
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingTextContent, setEditingTextContent] = useState('');
  const [editingFileName, setEditingFileName] = useState('');
  const [editingCategory, setEditingCategory] = useState(''); // New state for editing category


  // 1. Initialize Firebase and handle authentication
  useEffect(() => {
    try {
      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const firebaseAuth = getAuth(app);

      setDb(firestore);
      setAuth(firebaseAuth);

      const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
        if (user) {
          setUserId(user.uid);
          // Load user name from local storage
          const storedUserName = localStorage.getItem('userDisplayName');
          if (storedUserName) {
            setUserName(storedUserName);
            setEditUserName(storedUserName);
          } else {
            // If no name, prompt user to set it
            setUserName(`ผู้ใช้ไม่ระบุ (${user.uid.substring(0, 5)}...)`);
            setEditUserName('');
            setShowNameInput(true);
          }
        } else {
          // Attempt to sign in with custom token if available, otherwise anonymously
          if (typeof __initial_auth_token !== 'undefined') {
            await signInWithCustomToken(firebaseAuth, __initial_auth_token);
          } else {
            await signInAnonymously(firebaseAuth);
          }
        }
        setIsAuthReady(true);
        setLoading(false);
      });

      return () => unsubscribe(); // Cleanup auth listener
    } catch (error) {
      console.error("Firebase Initialization Error:", error);
      setErrorMessage("เกิดข้อผิดพลาดในการเริ่มต้น Firebase: " + error.message);
      setLoading(false);
    }
  }, []);

  // 2. Fetch shared items from Firestore
  useEffect(() => {
    if (db && isAuthReady) {
      const colRef = collection(db, `artifacts/${appId}/public/data/shared_files`);
      // Order by timestamp in descending order for newest first
      const q = query(colRef, orderBy('timestamp', 'desc'));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setSharedItems(items);
      }, (error) => {
        console.error("Firestore Fetch Error:", error);
        setErrorMessage("เกิดข้อผิดพลาดในการดึงข้อมูล: " + error.message);
      });

      return () => unsubscribe(); // Cleanup snapshot listener
    }
  }, [db, isAuthReady]);

  // Reset input fields when switching tabs
  useEffect(() => {
    setNewTextContent('');
    setNewFileName('');
    setSelectedCategory(CATEGORIES[0].value); // Reset category when switching tabs
    setErrorMessage('');
  }, [activeTab]);


  // Function to save user name to local storage
  const saveUserName = () => {
    if (editUserName.trim()) {
      localStorage.setItem('userDisplayName', editUserName.trim());
      setUserName(editUserName.trim());
      setShowNameInput(false);
    } else {
      setErrorMessage("กรุณาใส่ชื่อของคุณ");
    }
  };

  // Handle sharing text content
  const handleShareText = async () => {
    if (!newTextContent.trim()) {
      setErrorMessage("กรุณาใส่ข้อความที่คุณต้องการแบ่งปัน");
      return;
    }
    if (!userName || showNameInput) {
      setErrorMessage("กรุณาใส่ชื่อของคุณก่อนแบ่งปัน");
      setShowNameInput(true);
      return;
    }

    setLoading(true);
    setErrorMessage('');
    try {
      const colRef = collection(db, `artifacts/${appId}/public/data/shared_files`);
      await addDoc(colRef, {
        type: 'text',
        content: newTextContent,
        userId: userId,
        userName: userName,
        timestamp: Date.now(),
      });
      setNewTextContent('');
    } catch (error) {
      console.error("Error adding text document:", error);
      setErrorMessage("เกิดข้อผิดพลาดในการแบ่งปันข้อความ: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle sharing a file (metadata only)
  const handleShareFileMetadata = async () => {
    if (!newFileName.trim()) {
      setErrorMessage("กรุณาใส่ชื่อไฟล์");
      return;
    }
    if (!selectedCategory) {
      setErrorMessage("กรุณาเลือกหมวดหมู่");
      return;
    }
    if (!userName || showNameInput) {
      setErrorMessage("กรุณาใส่ชื่อของคุณก่อนแบ่งปัน");
      setShowNameInput(true);
      return;
    }

    setLoading(true);
    setErrorMessage('');
    try {
      const colRef = collection(db, `artifacts/${appId}/public/data/shared_files`);
      await addDoc(colRef, {
        type: 'file_metadata', // Changed type to indicate metadata only
        fileName: newFileName,
        category: selectedCategory, // Store selected category
        userId: userId,
        userName: userName,
        timestamp: Date.now(),
      });
      setNewFileName('');
      setSelectedCategory(CATEGORIES[0].value); // Reset category after sharing
    } catch (error) {
      console.error("Error adding file metadata document:", error);
      setErrorMessage("เกิดข้อผิดพลาดในการแบ่งปันไฟล์: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle deleting an item
  const handleDelete = async (id, itemUserId) => {
    if (itemUserId !== userId) {
      setErrorMessage("คุณไม่มีสิทธิ์ลบรายการนี้");
      return;
    }
    setLoading(true);
    setErrorMessage('');
    try {
      const docRef = doc(db, `artifacts/${appId}/public/data/shared_files`, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting document:", error);
      setErrorMessage("เกิดข้อผิดพลาดในการลบ: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle setting an item to editing mode
  const handleEditClick = (item) => {
    if (item.userId !== userId) {
      setErrorMessage("คุณไม่มีสิทธิ์แก้ไขรายการนี้");
      return;
    }
    setEditingItemId(item.id);
    if (item.type === 'text') {
      setEditingTextContent(item.content);
      setEditingFileName('');
      setEditingCategory('');
    } else if (item.type === 'file_metadata') { // Updated type
      setEditingTextContent('');
      setEditingFileName(item.fileName);
      setEditingCategory(item.category || CATEGORIES[0].value); // Set editing category
    }
    setErrorMessage(''); // Clear previous error messages
  };

  // Handle saving edited item
  const handleSaveEdit = async (item) => {
    setLoading(true);
    setErrorMessage('');
    try {
      const docRef = doc(db, `artifacts/${appId}/public/data/shared_files`, item.id);
      let updatedData = {};

      if (item.type === 'text') {
        if (!editingTextContent.trim()) {
          setErrorMessage("ข้อความที่แก้ไขไม่สามารถว่างเปล่าได้");
          setLoading(false);
          return;
        }
        updatedData = { content: editingTextContent.trim() };
      } else if (item.type === 'file_metadata') { // Updated type
        if (!editingFileName.trim()) {
          setErrorMessage("ชื่อไฟล์ที่แก้ไขไม่สามารถว่างเปล่าได้");
          setLoading(false);
          return;
        }
        if (!editingCategory) {
          setErrorMessage("หมวดหมู่ที่แก้ไขไม่สามารถว่างเปล่าได้");
          setLoading(false);
          return;
        }
        updatedData = {
          fileName: editingFileName.trim(),
          category: editingCategory, // Save edited category
        };
      }

      await updateDoc(docRef, updatedData);
      setEditingItemId(null); // Exit editing mode
      setEditingTextContent('');
      setEditingFileName('');
      setEditingCategory('');
    } catch (error) {
      console.error("Error updating document:", error);
      setErrorMessage("เกิดข้อผิดพลาดในการบันทึกการแก้ไข: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle canceling edit
  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditingTextContent('');
    setEditingFileName('');
    setEditingCategory('');
    setErrorMessage('');
  };

  // Handle printing (opens print dialog)
  const handlePrint = (content) => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>พิมพ์เนื้อหา</title>
          <style>
            body { font-family: 'Inter', sans-serif; margin: 20px; }
            pre { white-space: pre-wrap; word-wrap: break-word; }
          </style>
        </head>
        <body>
          <pre>${content}</pre>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              }
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
  };

  // Helper to get category label from value
  const getCategoryLabel = (value) => {
    const category = CATEGORIES.find(cat => cat.value === value);
    return category ? category.label : value;
  };

  if (loading && !isAuthReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <div className="text-xl font-semibold">กำลังโหลด...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 font-sans flex flex-col items-center">
      <div className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 space-y-6">
        <h1 className="text-3xl font-bold text-center text-blue-600 dark:text-blue-400 mb-6">
          แอปแบ่งปันไฟล์และข้อความ
        </h1>

        {/* User ID and Name Section */}
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md flex flex-col sm:flex-row items-center justify-between shadow-inner">
          <div className="flex items-center space-x-2 text-blue-800 dark:text-blue-200 mb-2 sm:mb-0">
            <User className="w-5 h-5" />
            <span className="font-medium">
              ID ผู้ใช้ปัจจุบัน: <span className="font-mono text-sm break-all">{userId}</span>
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="font-medium">ชื่อของคุณ:</span>
            {!showNameInput ? (
              <div className="flex items-center space-x-2">
                <span className="text-blue-700 dark:text-blue-300 font-semibold">{userName}</span>
                <button
                  onClick={() => {
                    setEditUserName(userName); // Set the current name to the edit input
                    setShowNameInput(true);
                  }}
                  className="p-1 rounded-full bg-blue-100 dark:bg-blue-700 hover:bg-blue-200 dark:hover:bg-blue-600 transition-colors"
                  aria-label="แก้ไขชื่อ"
                >
                  <Edit className="w-4 h-4 text-blue-600 dark:text-blue-200" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <input
                  type="text"
                  value={editUserName}
                  onChange={(e) => setEditUserName(e.target.value)}
                  placeholder="ใส่ชื่อของคุณ"
                  className="flex-grow p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={saveUserName}
                  className="p-2 rounded-md bg-blue-500 hover:bg-blue-600 text-white transition-colors flex items-center justify-center"
                  aria-label="บันทึกชื่อ"
                >
                  <Save className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowNameInput(false)}
                  className="p-2 rounded-md bg-red-500 hover:bg-red-600 text-white transition-colors flex items-center justify-center"
                  aria-label="ยกเลิก"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {errorMessage && (
          <div className="bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-3 rounded-md border border-red-200 dark:border-red-800">
            {errorMessage}
          </div>
        )}

        {/* Tabs for Text and File Metadata Upload */}
        <div className="flex space-x-2 mb-4 p-1 bg-gray-200 dark:bg-gray-700 rounded-lg">
          <button
            onClick={() => setActiveTab('text')}
            className={`flex-1 py-2 px-4 rounded-md transition-all duration-300 ${
              activeTab === 'text'
                ? 'bg-blue-500 text-white shadow-md'
                : 'bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            } flex items-center justify-center space-x-2`}
          >
            <FileText className="w-5 h-5" />
            <span>แบ่งปันข้อความ</span>
          </button>
          {/* Renamed to 'link' for consistency, but functionality is file metadata */}
          <button
            onClick={() => setActiveTab('link')}
            className={`flex-1 py-2 px-4 rounded-md transition-all duration-300 ${
              activeTab === 'link'
                ? 'bg-blue-500 text-white shadow-md'
                : 'bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            } flex items-center justify-center space-x-2`}
          >
            <Link className="w-5 h-5" />
            <span>แบ่งปันข้อมูลไฟล์</span> {/* Updated text */}
          </button>
        </div>

        {/* Content Sharing Section */}
        <div className="bg-gray-50 dark:bg-gray-700 p-5 rounded-lg shadow-inner">
          {activeTab === 'text' && (
            <div className="space-y-4">
              <textarea
                value={newTextContent}
                onChange={(e) => setNewTextContent(e.target.value)}
                placeholder="พิมพ์ข้อความที่คุณต้องการแบ่งปันที่นี่..."
                rows="6"
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500 resize-y"
              ></textarea>
              <button
                onClick={handleShareText}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-300 shadow-md transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading || !newTextContent.trim() || showNameInput}
              >
                {loading ? 'กำลังแบ่งปัน...' : 'แบ่งปันข้อความ'}
              </button>
            </div>
          )}

          {activeTab === 'link' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                แอปพลิเคชันนี้จะจัดเก็บเพียง **ชื่อไฟล์** และ **หมวดหมู่** เท่านั้น เพื่อให้คุณสามารถจัดการข้อมูลไฟล์ของคุณได้ ไฟล์จริงยังคงต้องถูกอัปโหลดและจัดการในบริการ Cloud Storage ภายนอกของคุณ (เช่น Google Drive, Dropbox)
              </p>
              
              <label htmlFor="file-name-input-link" className="block text-gray-700 dark:text-gray-300 font-medium">ชื่อไฟล์:</label>
              <input
                id="file-name-input-link"
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="เช่น: รายงานประจำเดือน.pdf"
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500"
              />

              <label htmlFor="file-input-actual" className="block text-gray-700 dark:text-gray-300 font-medium">เลือกไฟล์จากคอมพิวเตอร์ (เพื่อช่วยตั้งชื่อไฟล์):</label>
              <input
                id="file-input-actual"
                type="file"
                onChange={(e) => {
                  if (e.target.files.length > 0) {
                    setNewFileName(e.target.files[0].name); // Pre-fill file name
                  } else {
                    setNewFileName('');
                  }
                  setErrorMessage('');
                }}
                className="block w-full text-sm text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer bg-white dark:bg-gray-800 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-200 dark:hover:file:bg-blue-800"
              />

              <label htmlFor="category-select" className="block text-gray-700 dark:text-gray-300 font-medium">เลือกหมวดหมู่:</label>
              <select
                id="category-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>

              <button
                onClick={handleShareFileMetadata} // Updated handler
                className="w-full bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-300 shadow-md transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading || !newFileName.trim() || showNameInput}
              >
                {loading ? 'กำลังแบ่งปัน...' : 'แบ่งปันข้อมูลไฟล์'} {/* Updated text */}
              </button>
            </div>
          )}
        </div>

        {/* Shared Items List */}
        <div className="mt-8">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4 text-center">
            รายการที่แบ่งปัน
          </h2>
          {sharedItems.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 p-4 border border-gray-200 dark:border-gray-700 rounded-md">
              ยังไม่มีรายการที่แบ่งปัน ลองแบ่งปันข้อความหรือข้อมูลไฟล์สิ!
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {sharedItems.map((item) => (
                <div key={item.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5 flex flex-col justify-between border border-gray-200 dark:border-gray-700 transform hover:scale-100 hover:shadow-lg transition-all duration-200">
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {item.type === 'text' ? (
                      <FileText className="w-4 h-4 mr-2 text-blue-500" />
                    ) : (
                      <Link className="w-4 h-4 mr-2 text-purple-500" />
                    )}
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{item.userName}</span>
                    <span className="mx-1">•</span>
                    <span className="text-xs">{new Date(item.timestamp).toLocaleString()}</span>
                  </div>

                  {/* Render based on editing state */}
                  {editingItemId === item.id && item.userId === userId ? (
                    // Editing mode for current user's item
                    item.type === 'text' ? (
                      <div className="space-y-3 flex-grow mb-4">
                        <textarea
                          value={editingTextContent}
                          onChange={(e) => setEditingTextContent(e.target.value)}
                          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500"
                          rows="4"
                        ></textarea>
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleSaveEdit(item)}
                            className="p-2 rounded-md bg-green-500 hover:bg-green-600 text-white transition-colors duration-200 shadow-sm flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={loading}
                          >
                            <Save className="w-4 h-4" />
                            <span>บันทึก</span>
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="p-2 rounded-md bg-gray-500 hover:bg-gray-600 text-white transition-colors duration-200 shadow-sm flex items-center space-x-1"
                          >
                            <X className="w-4 h-4" />
                            <span>ยกเลิก</span>
                          </button>
                        </div>
                      </div>
                    ) : ( // file_metadata type
                      <div className="space-y-3 flex-grow mb-4">
                        <input
                          type="text"
                          value={editingFileName}
                          onChange={(e) => setEditingFileName(e.target.value)}
                          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="ชื่อไฟล์"
                        />
                        <select
                          value={editingCategory}
                          onChange={(e) => setEditingCategory(e.target.value)}
                          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500"
                        >
                          {CATEGORIES.map((cat) => (
                            <option key={cat.value} value={cat.value}>
                              {cat.label}
                            </option>
                          ))}
                        </select>
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleSaveEdit(item)}
                            className="p-2 rounded-md bg-green-500 hover:bg-green-600 text-white transition-colors duration-200 shadow-sm flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={loading}
                          >
                            <Save className="w-4 h-4" />
                            <span>บันทึก</span>
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="p-2 rounded-md bg-gray-500 hover:bg-gray-600 text-white transition-colors duration-200 shadow-sm flex items-center space-x-1"
                          >
                            <X className="w-4 h-4" />
                            <span>ยกเลิก</span>
                          </button>
                        </div>
                      </div>
                    )
                  ) : (
                    // Display mode
                    item.type === 'text' ? (
                      <>
                        <div className="flex-grow mb-4 bg-gray-100 dark:bg-gray-700 p-3 rounded-md max-h-40 overflow-auto text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600">
                          <pre className="whitespace-pre-wrap break-words text-sm">{item.content}</pre>
                        </div>
                        <div className="flex justify-end space-x-2">
                          {item.userId === userId && (
                            <>
                              <button
                                onClick={() => handleEditClick(item)}
                                className="p-2 rounded-md bg-yellow-500 hover:bg-yellow-600 text-white transition-colors duration-200 shadow-sm flex items-center space-x-1"
                              >
                                <Edit className="w-4 h-4" />
                                <span>แก้ไข</span>
                              </button>
                              <button
                                onClick={() => handleDelete(item.id, item.userId)}
                                className="p-2 rounded-md bg-red-500 hover:bg-red-600 text-white transition-colors duration-200 shadow-sm flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={loading}
                              >
                                <Trash2 className="w-4 h-4" />
                                <span>ลบ</span>
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handlePrint(item.content)}
                            className="p-2 rounded-md bg-blue-500 hover:bg-blue-600 text-white transition-colors duration-200 shadow-sm flex items-center space-x-1"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-printer"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>
                            <span>พิมพ์</span>
                          </button>
                        </div>
                      </>
                    ) : ( // file_metadata type
                      <>
                        <p className="font-semibold text-lg text-blue-700 dark:text-blue-300 mb-2 truncate">
                          {item.fileName}
                        </p>
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mb-3">
                          <span className="font-semibold text-purple-600 dark:text-purple-300">
                            หมวดหมู่: {getCategoryLabel(item.category)}
                          </span>
                        </div>

                        {/* Note: No 'ดู' (view) button as there is no URL stored here for direct viewing */}
                        <div className="flex justify-end space-x-2">
                          {item.userId === userId && (
                            <>
                              <button
                                onClick={() => handleEditClick(item)}
                                className="p-2 rounded-md bg-yellow-500 hover:bg-yellow-600 text-white transition-colors duration-200 shadow-sm flex items-center space-x-1"
                              >
                                <Edit className="w-4 h-4" />
                                <span>แก้ไข</span>
                              </button>
                              <button
                                onClick={() => handleDelete(item.id, item.userId)}
                                className="p-2 rounded-md bg-red-500 hover:bg-red-600 text-white transition-colors duration-200 shadow-sm flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={loading}
                              >
                                <Trash2 className="w-4 h-4" />
                                <span>ลบ</span>
                              </button>
                            </>
                          )}
                        </div>
                      </>
                    )
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
