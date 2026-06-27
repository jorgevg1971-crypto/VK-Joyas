using System;
using System.Diagnostics;
using System.ServiceProcess;
using System.IO;
using System.Threading;

namespace ePCBackup
{
    public class ePCBackupService : ServiceBase
    {
        private Process _nodeProcess;
        private string _logPath;
        private string _appDir;
        private bool _shouldRun = true;
        private Thread _monitorThread;

        public ePCBackupService()
        {
            this.ServiceName = "ePCBackupService";
            this.CanStop = true;
            this.CanPauseAndContinue = false;
            this.AutoLog = true;

            _appDir = AppDomain.CurrentDomain.BaseDirectory;
            _logPath = Path.Combine(_appDir, "service.log");
        }

        private void Log(string message)
        {
            try
            {
                string logLine = string.Format("[{0}] {1}{2}", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"), message, Environment.NewLine);
                File.AppendAllText(_logPath, logLine);
            }
            catch {}
        }

        protected override void OnStart(string[] args)
        {
            Log("Service is starting...");
            _shouldRun = true;

            _monitorThread = new Thread(MonitorProcessLoop);
            _monitorThread.IsBackground = true;
            _monitorThread.Start();

            Log("Service started monitor thread.");
        }

        private void MonitorProcessLoop()
        {
            int crashCount = 0;
            while (_shouldRun)
            {
                try
                {
                    string nodeScript = Path.Combine(_appDir, "backend", "index.js");
                    if (!File.Exists(nodeScript))
                    {
                        Log("Error: Backend entry point not found at: " + nodeScript);
                        Thread.Sleep(10000);
                        continue;
                    }

                    Log("Launching Node.js process with script: " + nodeScript);
                    
                    ProcessStartInfo psi = new ProcessStartInfo
                    {
                        FileName = "node.exe",
                        Arguments = "\"" + nodeScript + "\"",
                        WorkingDirectory = Path.Combine(_appDir, "backend"),
                        UseShellExecute = false,
                        CreateNoWindow = true,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true
                    };

                    _nodeProcess = new Process { StartInfo = psi };
                    
                    // Redirect output logs
                    _nodeProcess.OutputDataReceived += (sender, e) => {
                        if (!string.IsNullOrEmpty(e.Data)) Log("[Node-Out] " + e.Data);
                    };
                    _nodeProcess.ErrorDataReceived += (sender, e) => {
                        if (!string.IsNullOrEmpty(e.Data)) Log("[Node-Err] " + e.Data);
                    };

                    _nodeProcess.Start();
                    _nodeProcess.BeginOutputReadLine();
                    _nodeProcess.BeginErrorReadLine();

                    Log("Node.js process started successfully with PID: " + _nodeProcess.Id);
                    crashCount = 0; // reset crash count on successful start

                    _nodeProcess.WaitForExit();

                    if (_shouldRun)
                    {
                        int exitCode = _nodeProcess.ExitCode;
                        Log("Node.js process exited unexpectedly with code: " + exitCode);
                        crashCount++;

                        if (crashCount > 5)
                        {
                            Log("Node.js process crashed more than 5 times consecutively. Waiting 60 seconds before restarting...");
                            Thread.Sleep(60000);
                        }
                        else
                        {
                            Thread.Sleep(5000); // Wait 5 seconds before restart
                        }
                    }
                }
                catch (Exception ex)
                {
                    Log("Exception in process monitor loop: " + ex.ToString());
                    Thread.Sleep(10000);
                }
            }
        }

        protected override void OnStop()
        {
            Log("Service is stopping...");
            _shouldRun = false;

            try
            {
                if (_nodeProcess != null && !_nodeProcess.HasExited)
                {
                    Log("Terminating Node.js process (PID: " + _nodeProcess.Id + ")...");
                    _nodeProcess.Kill();
                    _nodeProcess.Close();
                }
            }
            catch (Exception ex)
            {
                Log("Error terminating Node.js process: " + ex.Message);
            }

            Log("Service stopped.");
        }

        public static void Main()
        {
            ServiceBase.Run(new ePCBackupService());
        }
    }
}
