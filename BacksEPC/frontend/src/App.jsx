import React, { useState, useEffect } from 'react';

// Helpers
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(isoString) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [status, setStatus] = useState(null);
  const [history, setHistory] = useState([]);
  
  // Config state
  const [sources, setSources] = useState([]);
  const [destination, setDestination] = useState('');
  const [nasUsername, setNasUsername] = useState('');
  const [nasPassword, setNasPassword] = useState('');
  const [scheduleType, setScheduleType] = useState('interval_days');
  const [scheduleDays, setScheduleDays] = useState([1, 2, 3, 4, 5]);
  const [scheduleInterval, setScheduleInterval] = useState(1);
  const [scheduleTime, setScheduleTime] = useState('22:00');
  const [retention, setRetention] = useState(5);
  const [newSourcePath, setNewSourcePath] = useState('');
  const [saveStatus, setSaveStatus] = useState({ success: null, message: '' });
  const [testConnectionStatus, setTestConnectionStatus] = useState({ success: null, message: '', loading: false });
  const [deviceIdentifier, setDeviceIdentifier] = useState('');
  
  // Network Console state
  const [networkMachines, setNetworkMachines] = useState([]);
  const [newMachineIp, setNewMachineIp] = useState('');
  const [machinesStatus, setMachinesStatus] = useState({});
  const [isConsolidating, setIsConsolidating] = useState({});
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [hasAdminPassword, setHasAdminPassword] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalType, setAuthModalType] = useState('login'); // 'login' or 'set'
  const [authError, setAuthError] = useState('');

  // Restore explorer state
  const [selectedRun, setSelectedRun] = useState(null);
  const [manifestFiles, setManifestFiles] = useState([]);
  const [currentPath, setCurrentPath] = useState(''); // current folder in explorer
  const [selectedExplorerItem, setSelectedExplorerItem] = useState(null);
  const [selectedExplorerItems, setSelectedExplorerItems] = useState([]);
  const [isFullRestore, setIsFullRestore] = useState(false);
  const [selectedFileVersions, setSelectedFileVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [restoreMode, setRestoreMode] = useState('original'); // 'original' or 'custom'
  const [customRestorePath, setCustomRestorePath] = useState('');
  const [restoreMessage, setRestoreMessage] = useState({ type: '', text: '' });
  const [isRestoring, setIsRestoring] = useState(false);

  // Local Folder Explorer State
  const [isFolderExplorerOpen, setIsFolderExplorerOpen] = useState(false);
  const [explorerDrives, setExplorerDrives] = useState([]);
  const [explorerCurrent, setExplorerCurrent] = useState('');
  const [explorerParent, setExplorerParent] = useState(null);
  const [explorerSubdirs, setExplorerSubdirs] = useState([]);
  const [explorerMode, setExplorerMode] = useState('source'); // 'source', 'destination', 'restore-custom'
  const [explorerError, setExplorerError] = useState(null);

  const loadLocalDir = async (pathQuery = '') => {
    setExplorerError(null);
    try {
      const url = pathQuery ? `/api/local-dir?path=${encodeURIComponent(pathQuery)}` : '/api/local-dir';
      const res = await fetch(url);
      
      if (!res.ok) {
        let errMsg = 'No se pudo cargar el directorio.';
        try {
          const data = await res.json();
          // If the backend returned a JSON error, use it
          errMsg = data.error || errMsg;
        } catch (jsonErr) {
          // If not JSON, use HTTP status
          errMsg = `Error ${res.status}: ${res.statusText || 'Respuesta no válida'}`;
        }
        setExplorerError(errMsg);
        return;
      }

      const data = await res.json();
      setExplorerDrives(data.drives || []);
      setExplorerCurrent(data.current || '');
      setExplorerParent(data.parent);
      setExplorerSubdirs(data.subdirs || []);
    } catch (err) {
      setExplorerError('Error de red al cargar el directorio.');
    }
  };

  const openFolderBrowser = (mode) => {
    setExplorerMode(mode);
    setIsFolderExplorerOpen(true);
    setExplorerError(null);
    
    let startPath = '';
    if (mode === 'source') startPath = newSourcePath;
    else if (mode === 'destination') startPath = destination;
    else if (mode === 'restore-custom') startPath = customRestorePath;

    if (startPath.startsWith('\\\\')) {
      startPath = '';
    }

    loadLocalDir(startPath);
  };

  const selectExplorerFolder = () => {
    if (explorerMode === 'source') {
      setNewSourcePath(explorerCurrent);
    } else if (explorerMode === 'destination') {
      setDestination(explorerCurrent);
    } else if (explorerMode === 'restore-custom') {
      setCustomRestorePath(explorerCurrent);
    }
    setIsFolderExplorerOpen(false);
  };

  // Poll status and fetch history
  useEffect(() => {
    fetchStatus();
    fetchHistory();
    fetchConfig();

    const interval = setInterval(() => {
      fetchStatus();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Update history when status changes from running to success/failed
  useEffect(() => {
    if (status && status.currentJob && status.currentJob.status === 'success') {
      fetchHistory();
    }
  }, [status?.currentJob?.status]);

  // Poll remote machines when network tab is active
  useEffect(() => {
    if (activeTab === 'network') {
      fetchRemoteStatuses();
      const interval = setInterval(() => {
        fetchRemoteStatuses();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab, networkMachines, adminPassword]);

  const handleNetworkTabClick = async () => {
    try {
      const res = await fetch('/api/network/auth/check');
      const data = await res.json();
      setHasAdminPassword(data.hasPassword);
      
      if (!data.hasPassword) {
        setAuthModalType('set');
        setIsAuthModalOpen(true);
        setAuthError('');
      } else if (!isAdminAuthenticated) {
        setAuthModalType('login');
        setIsAuthModalOpen(true);
        setAuthError('');
      } else {
        fetchNetworkMachines(adminPassword);
        setActiveTab('network');
      }
    } catch (err) {
      console.error('Error checking auth:', err);
    }
  };

  const handleSetAdminPassword = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await fetch('/api/network/auth/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPasswordInput })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAdminPassword(adminPasswordInput);
        setIsAdminAuthenticated(true);
        setIsAuthModalOpen(false);
        fetchNetworkMachines(adminPasswordInput);
        setAdminPasswordInput('');
        setActiveTab('network');
      } else {
        setAuthError(data.message || 'Error al guardar contraseña.');
      }
    } catch (err) {
      setAuthError('Error de conexión.');
    }
  };

  const handleLoginAdminPassword = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await fetch('/api/network/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPasswordInput })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAdminPassword(adminPasswordInput);
        setIsAdminAuthenticated(true);
        setIsAuthModalOpen(false);
        fetchNetworkMachines(adminPasswordInput);
        setAdminPasswordInput('');
        setActiveTab('network');
      } else {
        setAuthError(data.message || 'Contraseña incorrecta.');
      }
    } catch (err) {
      setAuthError('Error de conexión.');
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      setStatus(data);
    } catch (e) {
      console.error('Error fetching status:', e);
    }
  };

  const fetchNetworkMachines = async (pwdOverride) => {
    const pwd = pwdOverride !== undefined ? pwdOverride : adminPassword;
    try {
      const res = await fetch('/api/network/machines', {
        headers: { 'x-admin-password': pwd }
      });
      const data = await res.json();
      setNetworkMachines(data);
    } catch (e) {
      console.error('Error fetching network machines:', e);
    }
  };

  const saveNetworkMachinesList = async (list) => {
    try {
      const res = await fetch('/api/network/machines', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword
        },
        body: JSON.stringify({ machines: list })
      });
      const data = await res.json();
      if (data.success) {
        setNetworkMachines(list);
      }
    } catch (e) {
      console.error('Error saving network machines:', e);
    }
  };

  const addNetworkMachine = (e) => {
    e.preventDefault();
    if (!newMachineIp) return;
    
    const cleaned = newMachineIp.trim();
    if (networkMachines.includes(cleaned)) {
      alert('Esta máquina ya está registrada.');
      return;
    }
    const newList = [...networkMachines, cleaned];
    saveNetworkMachinesList(newList);
    setNewMachineIp('');
  };

  const removeNetworkMachine = async (ip) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar la máquina ${ip} de la consola de red?`)) {
      return;
    }
    
    try {
      const res = await fetch('/api/network/machines/remove', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword
        },
        body: JSON.stringify({ ip })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchNetworkMachines();
        
        const updatedStatus = { ...machinesStatus };
        delete updatedStatus[ip];
        setMachinesStatus(updatedStatus);
      } else {
        alert(`Error al eliminar: ${data.message}`);
      }
    } catch (e) {
      alert(`Error al conectar con el servidor local: ${e.message}`);
    }
  };

  const fetchRemoteStatuses = async () => {
    networkMachines.forEach(async (ip) => {
      if (!machinesStatus[ip]) {
        setMachinesStatus(prev => ({
          ...prev,
          [ip]: { loading: true, data: null, error: null }
        }));
      }

      try {
        const res = await fetch('/api/network/proxy', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-admin-password': adminPassword
          },
          body: JSON.stringify({
            ip,
            endpoint: '/api/status',
            method: 'GET'
          })
        });
        const data = await res.json();
        
        if (res.ok) {
          setMachinesStatus(prev => ({
            ...prev,
            [ip]: { loading: false, data, error: null }
          }));
        } else {
          setMachinesStatus(prev => ({
            ...prev,
            [ip]: { loading: false, data: null, error: data.message || 'Error de conexión remota.' }
          }));
        }
      } catch (err) {
        setMachinesStatus(prev => ({
          ...prev,
          [ip]: { loading: false, data: null, error: 'Sin conexión a la red local.' }
        }));
      }
    });
  };

  const triggerRemoteBackup = async (ip, type) => {
    try {
      const res = await fetch('/api/network/proxy', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword
        },
        body: JSON.stringify({
          ip,
          endpoint: '/api/backup',
          method: 'POST',
          payload: { type }
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchRemoteStatuses();
      } else {
        alert(`Error al iniciar backup remoto: ${data.message}`);
      }
    } catch (e) {
      alert(`Error al conectar con la máquina remota: ${e.message}`);
    }
  };

  const cancelRemoteBackup = async (ip) => {
    if (!window.confirm('¿Estás seguro de que deseas cancelar la copia de seguridad de esta máquina remota?')) {
      return;
    }
    try {
      const res = await fetch('/api/network/proxy', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword
        },
        body: JSON.stringify({
          ip,
          endpoint: '/api/backup/cancel',
          method: 'POST'
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchRemoteStatuses();
      } else {
        alert(`Error al cancelar backup remoto: ${data.message}`);
      }
    } catch (e) {
      alert(`Error al conectar con la máquina remota: ${e.message}`);
    }
  };

  const triggerRemoteConsolidate = async (ip, runId) => {
    if (!window.confirm(`¿Estás seguro de que deseas consolidar y comprimir en ZIP el último backup de la máquina remota ${ip}? Esto se ejecutará en segundo plano en esa máquina.`)) {
      return;
    }
    try {
      const res = await fetch('/api/network/proxy', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword
        },
        body: JSON.stringify({
          ip,
          endpoint: '/api/backup/consolidate',
          method: 'POST',
          payload: { runId }
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message);
      } else {
        alert(`Error al consolidar remoto: ${data.message}`);
      }
    } catch (e) {
      alert(`Error al conectar con la máquina remota: ${e.message}`);
    }
  };

  const handleConsolidateBackup = async (runId) => {
    if (!window.confirm('¿Estás seguro de que deseas consolidar y comprimir en ZIP todas las copias incrementales hasta esta versión? Esto puede tomar algunos minutos dependiendo del volumen de datos.')) {
      return;
    }

    setIsConsolidating(prev => ({ ...prev, [runId]: true }));
    try {
      const res = await fetch('/api/backup/consolidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
      } else {
        alert(`Error al consolidar: ${data.message}`);
      }
    } catch (err) {
      alert('Error de red al intentar consolidar el backup.');
    } finally {
      setIsConsolidating(prev => ({ ...prev, [runId]: false }));
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      setHistory(data);
    } catch (e) {
      console.error('Error fetching history:', e);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      setSources(data.sources || []);
      setDestination(data.destination || '');
      setDeviceIdentifier(data.deviceIdentifier || '');
      setNasUsername(data.nasUsername || '');
      setScheduleType(data.schedule?.type || 'interval_days');
      setScheduleDays(data.schedule?.daysOfWeek || [1, 2, 3, 4, 5]);
      setScheduleInterval(data.schedule?.intervalDays || 1);
      setScheduleTime(data.schedule?.time || '22:00');
      setRetention(data.retention || 5);
    } catch (e) {
      console.error('Error fetching config:', e);
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSaveStatus({ success: null, message: 'Guardando...' });
    try {
      const payload = {
        sources,
        destination,
        deviceIdentifier,
        nasUsername,
        schedule: {
          type: scheduleType,
          daysOfWeek: scheduleDays,
          intervalDays: Number(scheduleInterval),
          time: scheduleTime
        },
        retention: Number(retention)
      };

      if (nasPassword) {
        payload.nasPasswordDecrypted = nasPassword;
      }

      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        setSaveStatus({ success: true, message: 'Configuración guardada correctamente.' });
        setNasPassword(''); // Clear UI password state
        fetchStatus();
      } else {
        setSaveStatus({ success: false, message: 'Error: ' + data.message });
      }
    } catch (err) {
      setSaveStatus({ success: false, message: 'Error de red al guardar.' });
    }
  };

  const handleTestConnection = async () => {
    setTestConnectionStatus({ success: null, message: '', loading: true });
    try {
      const res = await fetch('/api/config/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination,
          nasUsername,
          nasPasswordDecrypted: nasPassword
        })
      });
      const data = await res.json();
      if (data.success) {
        setTestConnectionStatus({ success: true, message: data.message, loading: false });
      } else {
        setTestConnectionStatus({ success: false, message: data.message, loading: false });
      }
    } catch (err) {
      setTestConnectionStatus({ success: false, message: 'Error de red al intentar conectar.', loading: false });
    }
  };

  const triggerBackup = async (type) => {
    try {
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
      const data = await res.json();
      if (data.success) {
        fetchStatus();
      } else {
        alert('No se pudo iniciar el backup: ' + data.message);
      }
    } catch (err) {
      alert('Error al contactar al servidor.');
    }
  };

  const handleCancelBackup = async () => {
    if (!window.confirm('¿Estás seguro de que deseas cancelar la copia de seguridad actual?')) {
      return;
    }
    try {
      const res = await fetch('/api/backup/cancel', {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        fetchStatus();
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert('Error de red al intentar cancelar el backup.');
    }
  };

  const addSourcePath = () => {
    if (newSourcePath && !sources.includes(newSourcePath)) {
      setSources([...sources, newSourcePath]);
      setNewSourcePath('');
    }
  };

  const removeSourcePath = (index) => {
    const updated = sources.filter((_, i) => i !== index);
    setSources(updated);
  };

  const toggleDay = (dayNum) => {
    if (scheduleDays.includes(dayNum)) {
      setScheduleDays(scheduleDays.filter(d => d !== dayNum));
    } else {
      setScheduleDays([...scheduleDays, dayNum].sort());
    }
  };

  // RESTORE NAVIGATION LOGIC
  const selectRunForRestore = async (run) => {
    setSelectedRun(run);
    setCurrentPath('');
    setSelectedExplorerItem(null);
    setSelectedExplorerItems([]);
    setIsFullRestore(false);
    setRestoreMessage({ type: '', text: '' });
    try {
      const res = await fetch(`/api/browse?runId=${run.id}`);
      const data = await res.json();
      setManifestFiles(data.files || []);
    } catch (e) {
      console.error('Error loading manifest:', e);
      setManifestFiles([]);
    }
  };

  // Compile Explorer items dynamically based on current path
  const getExplorerItems = () => {
    const items = [];
    const seen = new Set();

    manifestFiles.forEach(f => {
      const rel = f.relPath;
      if (currentPath === '') {
        // Root: get first segments (folders like "0_Data")
        const firstSlash = rel.indexOf('/');
        if (firstSlash === -1) {
          items.push({ name: rel, path: rel, isDirectory: false, size: f.size, mtime: f.mtime });
        } else {
          const dirName = rel.substring(0, firstSlash);
          if (!seen.has(dirName)) {
            seen.add(dirName);
            // Label dir name prettily by showing original name if possible
            // 0_Data -> Data
            const label = dirName.substring(dirName.indexOf('_') + 1);
            items.push({ name: label, rawName: dirName, path: dirName, isDirectory: true });
          }
        }
      } else {
        // Inside some folder path
        if (rel.startsWith(currentPath + '/')) {
          const sub = rel.substring(currentPath.length + 1);
          const nextSlash = sub.indexOf('/');
          if (nextSlash === -1) {
            // File in current dir
            items.push({ name: sub, path: rel, isDirectory: false, size: f.size, mtime: f.mtime });
          } else {
            // Subdir in current dir
            const dirName = sub.substring(0, nextSlash);
            const fullDir = currentPath + '/' + dirName;
            if (!seen.has(fullDir)) {
              seen.add(fullDir);
              items.push({ name: dirName, rawName: dirName, path: fullDir, isDirectory: true });
            }
          }
        }
      }
    });

    // Sort: directories first, then files
    return items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  };

  const handleExplorerDoubleClick = (item) => {
    if (item.isDirectory) {
      setCurrentPath(item.path);
      setSelectedExplorerItem(null);
      setSelectedExplorerItems([]);
    } else {
      setIsFullRestore(false);
      openFileVersions(item);
    }
  };

  const openFileVersions = async (item) => {
    setSelectedExplorerItem(item);
    setIsFullRestore(false);
    try {
      const res = await fetch(`/api/file-versions?filePath=${encodeURIComponent(item.path)}`);
      const data = await res.json();
      setSelectedFileVersions(data);
      if (data.length > 0) {
        // Default to the version corresponding to the selected run, or the newest
        const matchingVer = data.find(v => v.runId === selectedRun.id) || data[0];
        setSelectedVersion(matchingVer);
      }
      setIsVersionModalOpen(true);
    } catch (e) {
      console.error('Error loading versions:', e);
    }
  };

  const openFullRestoreModal = () => {
    setIsFullRestore(true);
    setSelectedExplorerItem(null);
    setSelectedExplorerItems([]);
    setRestoreMessage({ type: '', text: '' });
    setIsVersionModalOpen(true);
  };

  const openMultiRestoreModal = () => {
    setIsFullRestore(false);
    setSelectedExplorerItem(null);
    setRestoreMessage({ type: '', text: '' });
    setIsVersionModalOpen(true);
  };

  const toggleItemSelection = (item) => {
    const isSelected = selectedExplorerItems.some(i => i.path === item.path);
    if (isSelected) {
      setSelectedExplorerItems(selectedExplorerItems.filter(i => i.path !== item.path));
    } else {
      setSelectedExplorerItems([...selectedExplorerItems, item]);
    }
  };

  const toggleSelectAllCurrent = () => {
    const currentItems = getExplorerItems();
    const allSelected = currentItems.every(item => selectedExplorerItems.some(i => i.path === item.path));
    
    if (allSelected) {
      const currentPaths = currentItems.map(i => i.path);
      setSelectedExplorerItems(selectedExplorerItems.filter(i => !currentPaths.includes(i.path)));
    } else {
      const itemsToAdd = currentItems.filter(item => !selectedExplorerItems.some(i => i.path === item.path));
      setSelectedExplorerItems([...selectedExplorerItems, ...itemsToAdd]);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    setRestoreMessage({ type: 'info', text: 'Iniciando restauración...' });

    try {
      const payload = {
        runId: selectedRun.id,
        restoreToOriginal: restoreMode === 'original',
        customPath: restoreMode === 'custom' ? customRestorePath : ''
      };

      if (isFullRestore) {
        payload.restoreAll = true;
      } else if (selectedExplorerItems.length > 0) {
        payload.items = selectedExplorerItems.map(item => ({
          relPath: item.path,
          isDirectory: item.isDirectory
        }));
      } else if (selectedExplorerItem) {
        payload.runId = selectedVersion ? selectedVersion.runId : selectedRun.id;
        payload.items = [
          {
            relPath: selectedExplorerItem.path,
            isDirectory: selectedExplorerItem.isDirectory
          }
        ];
      } else {
        throw new Error('No hay elementos seleccionados para restaurar.');
      }

      const res = await fetch('/api/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        setRestoreMessage({ type: 'success', text: `Restauración exitosa: ${data.message}` });
        setTimeout(() => {
          setIsVersionModalOpen(false);
        }, 1500);
      } else {
        setRestoreMessage({ type: 'error', text: `Error: ${data.message}` });
      }
    } catch (err) {
      setRestoreMessage({ type: 'error', text: err.message || 'Error de conexión con el servidor.' });
    } finally {
      setIsRestoring(false);
    }
  };

  const navigateUp = () => {
    if (currentPath === '') return;
    const lastSlash = currentPath.lastIndexOf('/');
    if (lastSlash === -1) {
      setCurrentPath('');
    } else {
      setCurrentPath(currentPath.substring(0, lastSlash));
    }
    setSelectedExplorerItem(null);
    setSelectedExplorerItems([]);
  };

  const isJobRunning = status?.currentJob?.status === 'scanning' || 
                       status?.currentJob?.status === 'copying' || 
                       status?.currentJob?.status === 'cleaning';

  return (
    <div className="app-container">
      <header>
        <div className="logo-section">
          <div className="logo-icon">ePC</div>
          <div className="logo-text">
            <h1>ePC Backups</h1>
            <span>Planificador & Restaurador de Copias</span>
          </div>
        </div>
        <nav>
          <button 
            className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>
            Dashboard
          </button>
          <button 
            className={`nav-tab ${activeTab === 'config' ? 'active' : ''}`}
            onClick={() => setActiveTab('config')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            Configuración
          </button>
          <button 
            className={`nav-tab ${activeTab === 'restore' ? 'active' : ''}`}
            onClick={() => setActiveTab('restore')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
            Restaurar Archivos
          </button>
          <button 
            className={`nav-tab ${activeTab === 'network' ? 'active' : ''}`}
            onClick={handleNetworkTabClick}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Consola de Red
          </button>
        </nav>
      </header>

      <main>
        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div>
            {/* Realtime progress tracker */}
            {status?.currentJob && status.currentJob.status !== 'idle' && (
              <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid var(--accent-purple)' }}>
                <div className="card-title" style={{ justifyContent: 'space-between' }}>
                  <span>
                    {status.currentJob.status === 'scanning' && 'Escaneando Archivos...'}
                    {status.currentJob.status === 'copying' && `Copiando Archivos (${status.currentJob.type.toUpperCase()})`}
                    {status.currentJob.status === 'cleaning' && 'Limpiando Backups Antiguos (Retención)...'}
                    {status.currentJob.status === 'failed' && 'Última Ejecución Fallida'}
                    {status.currentJob.status === 'success' && 'Última Ejecución Exitosa'}
                  </span>
                  <span className={`badge ${
                    isJobRunning ? 'badge-running' : 
                    status.currentJob.status === 'success' ? 'badge-success' : 'badge-failed'
                  }`}>
                    {status.currentJob.status}
                  </span>
                </div>
                
                <div style={{ wordBreak: 'break-all', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                  <strong>Archivo actual:</strong> {status.currentJob.progress?.currentFile || '-'}
                </div>

                {isJobRunning && (
                  <div className="progress-container">
                    <div className="progress-bar-bg">
                      <div 
                        className="progress-bar-fill" 
                        style={{ 
                          width: `${status.currentJob.progress?.totalFiles > 0 
                            ? Math.round((status.currentJob.progress.processedFiles / status.currentJob.progress.totalFiles) * 100) 
                            : 0}%` 
                        }}
                      ></div>
                    </div>
                    <div className="progress-details" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>
                        Procesados: {status.currentJob.progress?.processedFiles} / {status.currentJob.progress?.totalFiles} archivos
                      </span>
                      
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={handleCancelBackup}
                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', fontWeight: 600 }}
                      >
                        Cancelar Copia
                      </button>

                      <span>
                        Tamaño: {formatBytes(status.currentJob.progress?.bytesCopied || 0)} / {formatBytes(status.currentJob.progress?.totalBytes || 0)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quick Stats Grid */}
            <div className="grid-3">
              <div className="card stat-card">
                <div className="stat-icon" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-blue)' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                </div>
                <div className="stat-info">
                  <span className="stat-label">Espacio Total en NAS</span>
                  <span className="stat-value">{formatBytes(status?.totalSpaceUsed || 0)}</span>
                </div>
              </div>

              <div className="card stat-card">
                <div className="stat-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-green)' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
                <div className="stat-info">
                  <span className="stat-label">Copias Exitosas</span>
                  <span className="stat-value">{status?.totalSuccessfulBackups || 0}</span>
                </div>
              </div>

              <div className="card stat-card">
                <div className="stat-icon" style={{ backgroundColor: 'rgba(139, 92, 246, 0.15)', color: 'var(--accent-purple)' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <div className="stat-info">
                  <span className="stat-label">Último Backup</span>
                  <span className="stat-value" style={{ fontSize: '1rem', marginTop: '0.4rem', fontWeight: 600 }}>
                    {formatDate(status?.lastRunTimestamp)}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid-2">
              {/* Trigger Backup manually */}
              <div className="card">
                <h3 className="card-title">Copias Manuales</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                  Lanza un backup inmediatamente. Las copias de seguridad se ejecutan de fondo y el progreso se actualizará arriba.
                </p>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button 
                    className="btn btn-primary" 
                    onClick={() => triggerBackup('full')} 
                    disabled={isJobRunning || !status?.hasConfiguredSources || !status?.hasConfiguredDestination}
                  >
                    Backup Completo (Full)
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => triggerBackup('incremental')} 
                    disabled={isJobRunning || !status?.hasConfiguredSources || !status?.hasConfiguredDestination}
                  >
                    Backup Incremental
                  </button>
                </div>
                {(!status?.hasConfiguredSources || !status?.hasConfiguredDestination) && (
                  <p style={{ color: 'var(--accent-red)', fontSize: '0.8rem', marginTop: '1rem' }}>
                    * Configura el origen y destino en la pestaña Configuración antes de iniciar.
                  </p>
                )}
              </div>

              {/* Status information */}
              <div className="card">
                <h3 className="card-title">Servicio & Red</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
                  <div className="flex-between">
                    <span style={{ color: 'var(--text-secondary)' }}>Estado del Servicio Wrapper</span>
                    <span className="badge badge-success">Activo (Windows Service)</span>
                  </div>
                  <div className="flex-between">
                    <span style={{ color: 'var(--text-secondary)' }}>Conexión a Subred NAS</span>
                    <span className={`badge ${status?.hasConfiguredDestination ? 'badge-success' : 'badge-failed'}`}>
                      {status?.hasConfiguredDestination ? 'Conectado / Configurado' : 'Sin Configurar'}
                    </span>
                  </div>
                  <div className="flex-between">
                    <span style={{ color: 'var(--text-secondary)' }}>Frecuencia Programada</span>
                    <span className="badge badge-info">Activo</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Run History Table */}
            <div className="card">
              <h3 className="card-title">Historial Reciente de Copias</h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Tipo</th>
                      <th>Estado</th>
                      <th>Archivos Totales / Copiados</th>
                      <th>Tamaño Total / Copiado</th>
                      <th>Duración</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                          No hay registros de copias en el historial.
                        </td>
                      </tr>
                    ) : (
                      history.slice(0, 10).map((run) => (
                        <tr key={run.id}>
                          <td>{formatDate(run.timestamp)}</td>
                          <td>
                            <span className={`badge ${run.type === 'full' ? 'badge-info' : 'badge-secondary'}`}>
                              {run.type}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${run.status === 'success' ? 'badge-success' : run.status === 'running' ? 'badge-running' : 'badge-failed'}`}>
                              {run.status === 'success' ? 'Completado' : run.status === 'running' ? 'Ejecutando' : 'Error'}
                            </span>
                            {run.warnings && (
                              <span 
                                className="badge" 
                                title={run.warnings.join('\n')}
                                style={{ 
                                  marginLeft: '0.5rem', 
                                  cursor: 'help', 
                                  backgroundColor: 'rgba(245, 158, 11, 0.15)', 
                                  color: 'var(--accent-orange)', 
                                  border: '1px solid rgba(245, 158, 11, 0.3)' 
                                }}
                              >
                                ⚠️ Advertencia VSS
                              </span>
                            )}
                          </td>
                          <td>{run.filesCount} / {run.filesCopied}</td>
                          <td>{formatBytes(run.totalSize)} / {formatBytes(run.bytesCopied)}</td>
                          <td>{run.duration}s</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CONFIGURATION */}
        {activeTab === 'config' && (
          <form onSubmit={handleSaveConfig}>
            <div className="grid-2">
              {/* Folders Configuration */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                <h3 className="card-title">Carpetas de Origen</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  Añade las carpetas locales de las cuales se realizarán las copias de seguridad.
                </p>
                
                <div className="folder-add-section">
                  <input 
                    type="text" 
                    placeholder="Ej. C:\Usuarios\Jorge\Documentos" 
                    value={newSourcePath}
                    onChange={(e) => setNewSourcePath(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => openFolderBrowser('source')}
                  >
                    Examinar...
                  </button>
                  <button type="button" className="btn btn-primary" onClick={addSourcePath}>
                    Añadir
                  </button>
                </div>

                <div className="folder-list" style={{ flex: 1, marginTop: '1rem', minHeight: '150px' }}>
                  {sources.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '2rem 0' }}>
                      Ninguna carpeta configurada.
                    </div>
                  ) : (
                    sources.map((src, idx) => (
                      <div className="folder-item" key={idx}>
                        <span className="folder-path">{src}</span>
                        <button type="button" className="remove-folder-btn" onClick={() => removeSourcePath(idx)}>
                          &times;
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Destination NAS Configuration */}
              <div className="card">
                <h3 className="card-title">Destino Servidor NAS (Red)</h3>
                
                <div className="form-group">
                  <label>Identificador de este Equipo (Subcarpeta en NAS)</label>
                  <input 
                    type="text" 
                    placeholder="Ej. Contabilidad-01" 
                    value={deviceIdentifier}
                    onChange={(e) => setDeviceIdentifier(e.target.value)}
                    required
                  />
                  <div className="helper-text">
                    Nombre único para este equipo. Se creará una subcarpeta con este nombre en el NAS para mantener ordenadas las copias de seguridad de las computadoras.
                  </div>
                </div>

                <div className="form-group">
                  <label>Ruta UNC del Recurso Compartido NAS</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input 
                      type="text" 
                      placeholder="Ej. \\192.168.1.100\Backups" 
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      required
                      style={{ flex: 1 }}
                    />
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      onClick={() => openFolderBrowser('destination')}
                    >
                      Examinar...
                    </button>
                  </div>
                  <div className="helper-text">
                    La ruta de red del NAS que se encuentra en otra subnet.
                  </div>
                </div>

                <div className="form-group">
                  <label>Usuario del NAS</label>
                  <input 
                    type="text" 
                    placeholder="Ej. administrador" 
                    value={nasUsername}
                    onChange={(e) => setNasUsername(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Contraseña del NAS</label>
                  <input 
                    type="password" 
                    placeholder="Nueva contraseña (deja en blanco para mantener)" 
                    value={nasPassword}
                    onChange={(e) => setNasPassword(e.target.value)}
                  />
                  <div className="helper-text">
                    Las credenciales se cifrarán localmente y se guardarán de forma permanente.
                  </div>
                </div>

                <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleTestConnection}
                    disabled={testConnectionStatus.loading || !destination}
                  >
                    {testConnectionStatus.loading ? 'Probando...' : 'Probar Conexión'}
                  </button>
                  
                  {testConnectionStatus.message && (
                    <span style={{ 
                      fontSize: '0.85rem', 
                      fontWeight: 600, 
                      color: testConnectionStatus.success ? 'var(--accent-green)' : 'var(--accent-red)',
                      textAlign: 'right',
                      flex: 1
                    }}>
                      {testConnectionStatus.message}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid-2">
              {/* Schedule Configuration */}
              <div className="card">
                <h3 className="card-title">Planificación del Backup</h3>

                <div className="form-group">
                  <label>Tipo de Programación</label>
                  <select 
                    value={scheduleType}
                    onChange={(e) => setScheduleType(e.target.value)}
                  >
                    <option value="interval_days">Cada cierta cantidad de días</option>
                    <option value="days_of_week">Días específicos de la semana</option>
                  </select>
                </div>

                {scheduleType === 'interval_days' ? (
                  <div className="form-group">
                    <label>Ejecutar backup cada (en días):</label>
                    <input 
                      type="number" 
                      min="1" 
                      value={scheduleInterval}
                      onChange={(e) => setScheduleInterval(e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="form-group">
                    <label>Selecciona los días de copia:</label>
                    <div className="days-grid">
                      {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((name, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className={`day-btn ${scheduleDays.includes(idx) ? 'selected' : ''}`}
                          onClick={() => toggleDay(idx)}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label>Hora de ejecución (Formato 24h)</label>
                  <input 
                    type="text" 
                    placeholder="22:00" 
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    required
                  />
                  <div className="helper-text">Hora local de Windows. Ej: 23:30, 02:15.</div>
                </div>
              </div>

              {/* Retention Policy */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h3 className="card-title">Política de Retención y Rotación</h3>
                  
                  <div className="form-group">
                    <label>Límite de Copias Incrementales</label>
                    <input 
                      type="number" 
                      min="1" 
                      value={retention}
                      onChange={(e) => setRetention(e.target.value)}
                      required
                    />
                    <div className="helper-text" style={{ marginTop: '0.5rem' }}>
                      Determina cuántos backups incrementales se hacen antes de disparar un backup **Full** automáticamente.
                      Una vez completado el nuevo Full con éxito, el sistema borrará todo el ciclo anterior (el Full antiguo y sus incrementales) en el NAS para ahorrar espacio.
                    </div>
                  </div>
                </div>

                {/* Save button and status */}
                <div style={{ marginTop: '2rem' }}>
                  {saveStatus.message && (
                    <div style={{ 
                      color: saveStatus.success ? 'var(--accent-green)' : 'var(--accent-red)', 
                      fontSize: '0.9rem', 
                      marginBottom: '1rem',
                      fontWeight: 500
                    }}>
                      {saveStatus.message}
                    </div>
                  )}
                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={isJobRunning}>
                    Guardar Configuración
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}

        {/* TAB 3: RESTORE AND EXPLORER */}
        {activeTab === 'restore' && (
          <div className="card">
            <h3 className="card-title">Restauración e Historial de Archivos</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Selecciona una copia en la barra lateral para ver su estructura de archivos, luego haz doble clic en cualquier archivo para ver sus versiones disponibles y restaurarlo.
            </p>

            <div className="restore-layout">
              {/* Runs List */}
              <div className="restore-sidebar">
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
                  Copias Disponibles
                </h4>
                <div className="run-selector-list">
                  {history.filter(r => r.status === 'success').length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '2rem 0' }}>
                      No hay copias exitosas disponibles para restaurar.
                    </div>
                  ) : (
                    history.filter(r => r.status === 'success').map((run) => (
                      <div
                        key={run.id}
                        className={`run-select-item ${selectedRun?.id === run.id ? 'selected' : ''}`}
                        onClick={() => selectRunForRestore(run)}
                        style={{ cursor: 'pointer', display: 'block', textAlign: 'left' }}
                      >
                        <div className="run-select-title">
                          <span style={{ marginRight: '0.5rem' }}>
                            {run.type === 'full' ? '🔵 FULL' : '🟢 INC'}
                          </span>
                          {run.folderName}
                        </div>
                        <div className="run-select-date" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>{formatDate(run.timestamp)} ({formatBytes(run.totalSize)})</span>
                          
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConsolidateBackup(run.id);
                            }}
                            disabled={isConsolidating[run.id]}
                            style={{ 
                              padding: '0.15rem 0.4rem', 
                              fontSize: '0.7rem', 
                              fontWeight: 600,
                              backgroundColor: 'rgba(59, 130, 246, 0.15)',
                              color: 'var(--accent-blue)',
                              border: '1px solid rgba(59, 130, 246, 0.3)',
                              borderRadius: '0.25rem',
                              cursor: 'pointer'
                            }}
                          >
                            {isConsolidating[run.id] ? 'Consolidando...' : 'ZIP'}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* File Tree Explorer */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {selectedRun ? (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <div className="file-explorer-header" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                      {/* Breadcrumbs */}
                      <div className="breadcrumb" style={{ marginRight: 'auto', marginBottom: 0 }}>
                        <span className="breadcrumb-item" onClick={() => setCurrentPath('')}>
                          Raíz
                        </span>
                        {currentPath.split('/').filter(p => p !== '').map((part, idx, arr) => {
                          const fullSubPath = arr.slice(0, idx + 1).join('/');
                          // Clean labels for roots
                          let label = part;
                          if (idx === 0 && part.includes('_')) {
                            label = part.substring(part.indexOf('_') + 1);
                          }
                          return (
                            <React.Fragment key={idx}>
                              <span> / </span>
                              <span 
                                className="breadcrumb-item" 
                                onClick={() => setCurrentPath(fullSubPath)}
                              >
                                {label}
                              </span>
                            </React.Fragment>
                          );
                        })}
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button 
                          className="btn btn-success" 
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', fontWeight: 600 }}
                          onClick={openFullRestoreModal}
                        >
                          Restaurar Copia Completa
                        </button>
                        
                        {currentPath !== '' && (
                          <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={navigateUp}>
                            Volver Arriba
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="file-list-container" style={{ flex: 1 }}>
                      {/* Table headers */}
                      <div className="file-explorer-item" style={{ fontWeight: 600, borderBottom: '2px solid var(--border-color)', cursor: 'default' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                          <input 
                            type="checkbox"
                            checked={getExplorerItems().length > 0 && getExplorerItems().every(item => selectedExplorerItems.some(i => i.path === item.path))}
                            onChange={toggleSelectAllCurrent}
                            style={{ cursor: 'pointer' }}
                          />
                        </div>
                        <div></div>
                        <div>Nombre</div>
                        <div>Tamaño</div>
                        <div>Modificado</div>
                        <div></div>
                      </div>

                      {getExplorerItems().length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          Carpeta vacía.
                        </div>
                      ) : (
                        getExplorerItems().map((item, idx) => {
                          const isSelected = selectedExplorerItems.some(i => i.path === item.path);
                          return (
                            <div 
                              key={idx} 
                              className={`file-explorer-item ${selectedExplorerItem?.path === item.path || isSelected ? 'selected' : ''}`}
                              onDoubleClick={() => handleExplorerDoubleClick(item)}
                              onClick={() => setSelectedExplorerItem(item)}
                            >
                              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                                <input 
                                  type="checkbox" 
                                  checked={isSelected}
                                  onChange={() => toggleItemSelection(item)}
                                  style={{ cursor: 'pointer' }}
                                />
                              </div>
                              <div className="file-icon">
                                {item.isDirectory ? '📁' : '📄'}
                              </div>
                              <div className="file-name" style={{ fontWeight: item.isDirectory ? 600 : 400 }}>
                                {item.name}
                              </div>
                              <div className="file-size">
                                {item.isDirectory ? '-' : formatBytes(item.size)}
                              </div>
                              <div className="file-date">
                                {item.isDirectory ? '-' : formatDate(item.mtime)}
                              </div>
                              <div>
                                {!item.isDirectory && (
                                  <button 
                                    className="btn btn-secondary" 
                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openFileVersions(item);
                                    }}
                                  >
                                    Versiones
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                      {selectedExplorerItems.length > 0 ? (
                        <button 
                          className="btn btn-primary" 
                          onClick={openMultiRestoreModal}
                        >
                          Restaurar Seleccionados ({selectedExplorerItems.length})
                        </button>
                      ) : (
                        selectedExplorerItem && (
                          <button 
                            className="btn btn-primary" 
                            onClick={() => {
                              if (selectedExplorerItem.isDirectory) {
                                setSelectedExplorerItems([selectedExplorerItem]);
                                openMultiRestoreModal();
                              } else {
                                openFileVersions(selectedExplorerItem);
                              }
                            }}
                          >
                            Restaurar {selectedExplorerItem.isDirectory ? `Carpeta "${selectedExplorerItem.name}"` : selectedExplorerItem.name}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border-color)', borderRadius: '1rem', color: 'var(--text-muted)' }}>
                    Selecciona una copia en la lista de la izquierda para comenzar a explorar y restaurar.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: NETWORK CONSOLE */}
        {activeTab === 'network' && (
          <div>
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h3 className="card-title">Registrar Nueva Computadora</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                Añade la dirección IP y el puerto de red de otra máquina cliente en tu oficina local que tenga instalado ePC Backups (ej: <code>192.168.1.102:8282</code> o <code>DESKTOP-CONTA:8282</code>).
              </p>
              
              <form onSubmit={addNetworkMachine} style={{ display: 'flex', gap: '0.75rem' }}>
                <input
                  type="text"
                  placeholder="Ej. 192.168.1.105:8282"
                  value={newMachineIp}
                  onChange={(e) => setNewMachineIp(e.target.value)}
                  style={{ flex: 1, marginTop: 0 }}
                  required
                />
                <button type="submit" className="btn btn-primary">
                  Agregar Equipo
                </button>
              </form>
            </div>

            <div className="card">
              <h3 className="card-title">Estado de la Red de Backups</h3>
              <div className="table-container" style={{ marginTop: '1rem' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Identificador / Dirección IP</th>
                      <th>Estado Remoto</th>
                      <th>Última Copia</th>
                      <th>Progreso</th>
                      <th>Acciones de Control Remoto</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {networkMachines.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem 0' }}>
                          Ninguna máquina remota registrada para monitorear.
                        </td>
                      </tr>
                    ) : (
                      networkMachines.map((ip) => {
                        const statusInfo = machinesStatus[ip];
                        const loading = statusInfo?.loading;
                        const error = statusInfo?.error;
                        const data = statusInfo?.data;
                        const deviceId = data?.deviceIdentifier || (error ? 'Desconectado' : 'Cargando...');
                        const currentJob = data?.currentJob;
                        const jobStatus = currentJob?.status;
                        const lastRun = data?.lastRunTimestamp;
                        const lastRunType = data?.lastRunType;
                        const lastRunHasVssWarning = data?.lastRunHasVssWarning;
                        const lastRunId = data?.lastRunId;

                        const isRunning = currentJob && jobStatus !== 'idle';
                        const currentFile = currentJob?.progress?.currentFile;
                        const processed = currentJob?.progress?.processedFiles || 0;
                        const total = currentJob?.progress?.totalFiles || 0;
                        const pct = total > 0 ? Math.round((processed / total) * 100) : 0;

                        const isCopying = currentJob && (
                          jobStatus === 'scanning' || 
                          jobStatus === 'copying' || 
                          jobStatus === 'cleaning'
                        );
                        
                        return (
                          <tr key={ip}>
                            <td style={{ fontWeight: 600 }}>
                              {deviceId}
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400, marginTop: '0.1rem' }}>
                                {ip}
                              </div>
                            </td>
                            <td>
                              {loading ? (
                                <span style={{ color: 'var(--text-muted)' }}>Cargando estado...</span>
                              ) : error ? (
                                <span className="badge badge-failed" title={error}>
                                  ⚠️ Desconectado
                                </span>
                              ) : currentJob ? (
                                <span className={`badge ${
                                  jobStatus === 'success' ? 'badge-success' :
                                  jobStatus === 'running' || jobStatus === 'scanning' || jobStatus === 'copying' || jobStatus === 'cleaning' ? 'badge-running' : 
                                  jobStatus === 'idle' ? 'badge-secondary' : 'badge-failed'
                                }`}>
                                  {jobStatus === 'idle' ? 'Listo (Listo)' :
                                   jobStatus === 'success' ? 'Completado' :
                                   jobStatus === 'scanning' ? 'Escaneando' :
                                   jobStatus === 'copying' ? 'Copiando' :
                                   jobStatus === 'cleaning' ? 'Limpiando' : 'Error'}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>-</span>
                              )}
                            </td>
                            <td>
                              {lastRun ? (
                                <div>
                                  <div>{formatDate(lastRun)}</div>
                                  <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.25rem' }}>
                                    <span style={{ 
                                      fontSize: '0.65rem', 
                                      padding: '0.1rem 0.3rem', 
                                      borderRadius: '0.25rem',
                                      backgroundColor: lastRunType === 'full' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                      color: lastRunType === 'full' ? 'var(--accent-blue)' : 'var(--accent-green)',
                                      fontWeight: 600
                                    }}>
                                      {lastRunType === 'full' ? 'FULL' : 'INCREMENTAL'}
                                    </span>
                                    {lastRunHasVssWarning && (
                                      <span style={{ 
                                        fontSize: '0.65rem', 
                                        padding: '0.1rem 0.3rem', 
                                        borderRadius: '0.25rem',
                                        backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                        color: 'var(--accent-orange)',
                                        fontWeight: 600
                                      }} title="La última copia de seguridad tuvo advertencias de VSS al abrir archivos bloqueados">
                                        ⚠️ VSS
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>Ninguna o desconocido</span>
                              )}
                            </td>
                            <td>
                              {isRunning ? (
                                <div style={{ minWidth: '120px' }}>
                                  <div style={{ fontSize: '0.75rem', marginBottom: '0.2rem', wordBreak: 'break-all' }}>
                                    {currentFile || 'Iniciando...'}
                                  </div>
                                  <div className="progress-bar-bg" style={{ height: '6px' }}>
                                    <div 
                                      className="progress-bar-fill"
                                      style={{ 
                                        height: '6px',
                                        width: `${pct}%` 
                                      }}
                                    ></div>
                                  </div>
                                </div>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>-</span>
                              )}
                            </td>
                            <td>
                              {!loading && !error && data ? (
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  {isCopying ? (
                                    <button 
                                      type="button"
                                      className="btn btn-danger" 
                                      style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', fontWeight: 600 }}
                                      onClick={() => cancelRemoteBackup(ip)}
                                    >
                                      Cancelar Copia
                                    </button>
                                  ) : (
                                    <>
                                      <button 
                                        type="button"
                                        className="btn btn-secondary" 
                                        style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', fontWeight: 600 }}
                                        onClick={() => triggerRemoteBackup(ip, 'incremental')}
                                      >
                                        Incremental
                                      </button>
                                      <button 
                                        type="button"
                                        className="btn btn-primary" 
                                        style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', fontWeight: 600 }}
                                        onClick={() => triggerRemoteBackup(ip, 'full')}
                                      >
                                        Completo
                                      </button>
                                      {lastRunId && (
                                        <button 
                                          type="button"
                                          className="btn btn-secondary" 
                                          style={{ 
                                            padding: '0.35rem 0.6rem', 
                                            fontSize: '0.75rem', 
                                            fontWeight: 600,
                                            backgroundColor: 'rgba(59, 130, 246, 0.15)',
                                            color: 'var(--accent-blue)',
                                            border: '1px solid rgba(59, 130, 246, 0.3)'
                                          }}
                                          onClick={() => triggerRemoteConsolidate(ip, lastRunId)}
                                        >
                                          📦 Consolidar ZIP
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              ) : error ? (
                                <span style={{ fontSize: '0.8rem', color: 'var(--accent-red)' }}>{error}</span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>-</span>
                              )}
                            </td>
                            <td>
                              <button 
                                type="button"
                                className="remove-folder-btn" 
                                title="Eliminar máquina de la consola"
                                onClick={() => removeNetworkMachine(ip)}
                                style={{ padding: '0.2rem 0.5rem', fontSize: '1.2rem', lineHeight: 1 }}
                              >
                                &times;
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* VERSION SELECTOR & RESTORE MODAL */}
      {isVersionModalOpen && selectedRun && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                {isFullRestore ? 'Restauración Completa' : 
                 selectedExplorerItems.length > 0 ? 'Restaurar Elementos Seleccionados' : 
                 selectedExplorerItem?.isDirectory ? `Restaurar carpeta: ${selectedExplorerItem?.name}` : 
                 `Restaurar archivo: ${selectedExplorerItem?.name}`}
              </h3>
              <button className="modal-close" onClick={() => {
                setIsVersionModalOpen(false);
                setRestoreMessage({ type: '', text: '' });
              }}>&times;</button>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              {isFullRestore ? (
                <span>Se restaurará el 100% de los archivos de la copia de seguridad: <strong>{formatDate(selectedRun.timestamp)}</strong>.</span>
              ) : selectedExplorerItems.length > 0 ? (
                <span>Se restaurarán los <strong>{selectedExplorerItems.length}</strong> elementos seleccionados de la copia de seguridad.</span>
              ) : (
                <>
                  Ruta en el backup: <br />
                  <code style={{ color: 'var(--accent-purple)', wordBreak: 'break-all' }}>{selectedExplorerItem?.path}</code>
                </>
              )}
            </div>

            {/* List versions (Only for single files) */}
            {!isFullRestore && selectedExplorerItems.length === 0 && selectedExplorerItem && !selectedExplorerItem.isDirectory && (
              <div style={{ marginBottom: '1.5rem' }}>
                <label>Selecciona la versión del archivo a restaurar:</label>
                <div style={{ maxHeight: '180px', overflowY: 'auto', marginTop: '0.5rem' }}>
                  {selectedFileVersions.map((ver, idx) => (
                    <div 
                      key={idx}
                      className={`version-item ${selectedVersion?.runId === ver.runId ? 'selected' : ''}`}
                      onClick={() => setSelectedVersion(ver)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                          Copia: {ver.runFolderName}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                          Fecha backup: {formatDate(ver.runTimestamp)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 500 }}>{formatBytes(ver.size)}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                          Modificado: {formatDate(ver.mtime)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Destination Selection */}
            <div className="card" style={{ padding: '1rem', backgroundColor: 'rgba(0, 0, 0, 0.2)', marginBottom: '1.25rem' }}>
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="restoreMode" 
                    checked={restoreMode === 'original'}
                    onChange={() => setRestoreMode('original')}
                  />
                  Restaurar en la carpeta de origen original
                </label>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="restoreMode" 
                    checked={restoreMode === 'custom'}
                    onChange={() => setRestoreMode('custom')}
                  />
                  Restaurar en una carpeta personalizada
                </label>

                {restoreMode === 'custom' && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <input 
                      type="text" 
                      placeholder="Ej. C:\Recuperados" 
                      value={customRestorePath}
                      onChange={(e) => setCustomRestorePath(e.target.value)}
                      style={{ marginTop: 0, flex: 1 }}
                      required={restoreMode === 'custom'}
                    />
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      onClick={() => openFolderBrowser('restore-custom')}
                    >
                      Examinar...
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Restore Messages */}
            {restoreMessage.text && (
              <div style={{ 
                color: restoreMessage.type === 'success' ? 'var(--accent-green)' : 
                       restoreMessage.type === 'error' ? 'var(--accent-red)' : 'var(--text-secondary)', 
                fontSize: '0.85rem', 
                marginBottom: '1rem',
                fontWeight: 500 
              }}>
                {restoreMessage.text}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  setIsVersionModalOpen(false);
                  setRestoreMessage({ type: '', text: '' });
                }}
                disabled={isRestoring}
              >
                Cancelar
              </button>
              <button 
                className="btn btn-success" 
                onClick={handleRestore}
                disabled={isRestoring || (restoreMode === 'custom' && !customRestorePath)}
              >
                {isRestoring ? 'Restaurando...' : 'Restaurar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOCAL FOLDER EXPLORER MODAL */}
      {isFolderExplorerOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '600px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                Examinar Carpetas Locales
              </h3>
              <button type="button" className="modal-close" onClick={() => setIsFolderExplorerOpen(false)}>&times;</button>
            </div>

            {/* Drives selector */}
            <div style={{ marginBottom: '1rem' }}>
              <label>Unidades Disponibles:</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                {explorerDrives.map((drive, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`day-btn ${explorerCurrent.startsWith(drive) ? 'selected' : ''}`}
                    onClick={() => loadLocalDir(drive)}
                    style={{ minWidth: '60px' }}
                  >
                    💾 {drive}
                  </button>
                ))}
              </div>
            </div>

            {/* Current Path & Up button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <div className="breadcrumb" style={{ flex: 1, overflowX: 'auto', whiteSpace: 'nowrap', textAlign: 'left' }}>
                <strong>Ruta:</strong> {explorerCurrent || 'Selecciona una unidad'}
              </div>
              {explorerParent !== null && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                  onClick={() => loadLocalDir(explorerParent)}
                >
                  ⬆️ Subir
                </button>
              )}
            </div>

            {/* Error Message */}
            {explorerError && (
              <div style={{ color: 'var(--accent-red)', fontSize: '0.85rem', marginBottom: '1rem', fontWeight: 500, textAlign: 'left' }}>
                {explorerError}
              </div>
            )}

            {/* Subfolders list */}
            <div className="file-list-container" style={{ maxHeight: '250px', overflowY: 'auto', marginBottom: '1.5rem' }}>
              {explorerSubdirs.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  No hay subcarpetas accesibles.
                </div>
              ) : (
                explorerSubdirs.map((dir, idx) => (
                  <div
                    key={idx}
                    className="file-explorer-item"
                    style={{ gridTemplateColumns: '30px 1fr', textAlign: 'left' }}
                    onClick={() => loadLocalDir(dir.path)}
                  >
                    <div className="file-icon">📁</div>
                    <div className="file-name" style={{ fontWeight: 500 }}>{dir.name}</div>
                  </div>
                ))
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsFolderExplorerOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={selectExplorerFolder}
                disabled={!explorerCurrent}
              >
                Seleccionar Carpeta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADMINISTRATOR AUTH MODAL */}
      {isAuthModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                {authModalType === 'set' ? 'Definir Contraseña de Administración' : 'Acceso Restringido'}
              </h3>
              <button 
                type="button" 
                className="close-modal-btn" 
                onClick={() => setIsAuthModalOpen(false)}
                style={{ fontSize: '1.5rem', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={authModalType === 'set' ? handleSetAdminPassword : handleLoginAdminPassword}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem 0' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {authModalType === 'set' 
                    ? 'Establece una contraseña de administrador para proteger el acceso a la Consola de Red. Esta contraseña se guardará cifrada.'
                    : 'Se requiere la contraseña de administrador para ingresar a la Consola de Red y controlar los equipos remotos.'}
                </p>
                
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Contraseña de Administrador</label>
                  <input
                    type="password"
                    placeholder="Ingresa la contraseña"
                    value={adminPasswordInput}
                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                
                {authError && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--accent-red)', fontWeight: 600 }}>
                    ❌ {authError}
                  </div>
                )}
              </div>
              
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setIsAuthModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {authModalType === 'set' ? 'Guardar y Entrar' : 'Verificar y Entrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
