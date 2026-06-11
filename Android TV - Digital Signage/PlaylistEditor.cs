using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Windows.Forms;
using System.Drawing;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;

namespace PlaylistEditorApp
{
    [DataContract]
    public class PowerSchedule
    {
        [DataMember(Order = 1, EmitDefaultValue = true)]
        public bool enabled { get; set; }

        [DataMember(Order = 2, EmitDefaultValue = true)]
        public string on_time { get; set; }

        [DataMember(Order = 3, EmitDefaultValue = true)]
        public string off_time { get; set; }

        [DataMember(Order = 4, EmitDefaultValue = true)]
        public string days { get; set; }
    }

    [DataContract]
    public class PlaylistRoot
    {
        [DataMember(Order = 1, EmitDefaultValue = true)]
        public PowerSchedule power_schedule { get; set; }

        [DataMember(Order = 2, EmitDefaultValue = true)]
        public List<PlaylistItem> items { get; set; }
    }

    [DataContract]
    public class PlaylistItem
    {
        [DataMember(Order = 1, EmitDefaultValue = true)]
        public string layout { get; set; }

        [DataMember(Order = 2, EmitDefaultValue = false)]
        public string file { get; set; }
        
        [DataMember(Order = 3, EmitDefaultValue = true)]
        public string main_file { get; set; }

        [DataMember(Order = 4, EmitDefaultValue = true)]
        public string sidebar_file { get; set; }

        [DataMember(Order = 5, EmitDefaultValue = true)]
        public string ticker_text { get; set; }

        [DataMember(Order = 6, EmitDefaultValue = true)]
        public int? duration { get; set; }
        
        [DataMember(Order = 7, EmitDefaultValue = true)]
        public string schedule { get; set; }
        
        [DataMember(Order = 8, EmitDefaultValue = true)]
        public string days { get; set; }

        [DataMember(Order = 9, EmitDefaultValue = true)]
        public int? zoom { get; set; }

        [DataMember(Order = 10, EmitDefaultValue = true)]
        public int? sidebar_zoom { get; set; }
    }

    public class PlaylistForm : Form
    {
        private ListBox lbDiskFiles;
        private DataGridView dgvPlaylist;
        private Button btnAdd;
        private Button btnRemove;
        private Button btnMoveUp;
        private Button btnMoveDown;
        private Button btnSave;
        private Button btnRefresh;
        private Label lblPath;

        private CheckBox chkTvEnabled;
        private TextBox txtTvOnTime;
        private TextBox txtTvOffTime;
        private Button btnTvDays;
        private Label lblTvDaysShow;
        private string tvDays = "lun,mar,mie,jue,vie,sab,dom";

        private string currentDir;
        private readonly string[] supportedExtensions = new string[] { ".png", ".jpg", ".jpeg", ".webp", ".mp4", ".mkv", ".avi" };
        private List<string> diskFiles = new List<string>();

        public PlaylistForm()
        {
            InitializeComponent();
            currentDir = AppDomain.CurrentDomain.BaseDirectory;
            lblPath.Text = "Carpeta: " + currentDir;
            LoadFilesFromDisk();
            LoadPlaylistJson();
        }

        private void InitializeComponent()
        {
            this.Text = "Configurador de Playlist - Digital Signage";
            this.Size = new Size(1150, 700);
            this.MinimumSize = new Size(950, 500);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.FromArgb(24, 24, 28);
            this.ForeColor = Color.FromArgb(240, 240, 245);
            this.Font = new Font("Segoe UI", 10F, FontStyle.Regular);

            Panel pnlHeader = new Panel();
            pnlHeader.Height = 60;
            pnlHeader.Width = 1150;
            pnlHeader.Dock = DockStyle.Top;
            pnlHeader.BackColor = Color.FromArgb(18, 18, 22);

            lblPath = new Label();
            lblPath.Text = "Carpeta: ";
            lblPath.Location = new Point(20, 20);
            lblPath.AutoSize = true;
            lblPath.ForeColor = Color.FromArgb(180, 180, 190);
            pnlHeader.Controls.Add(lblPath);

            btnRefresh = new Button();
            btnRefresh.Text = "🔄 Actualizar";
            btnRefresh.Location = new Point(800, 12);
            btnRefresh.Size = new Size(120, 35);
            btnRefresh.FlatStyle = FlatStyle.Flat;
            btnRefresh.BackColor = Color.FromArgb(40, 40, 48);
            btnRefresh.ForeColor = Color.White;
            btnRefresh.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            btnRefresh.Click += new EventHandler(btnRefresh_Click);
            pnlHeader.Controls.Add(btnRefresh);

            btnSave = new Button();
            btnSave.Text = "💾 Guardar playlist.json";
            btnSave.Location = new Point(930, 12);
            btnSave.Size = new Size(180, 35);
            btnSave.FlatStyle = FlatStyle.Flat;
            btnSave.BackColor = Color.FromArgb(10, 130, 80);
            btnSave.ForeColor = Color.White;
            btnSave.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            btnSave.Click += new EventHandler(btnSave_Click);
            pnlHeader.Controls.Add(btnSave);

            Panel pnlLeft = new Panel();
            pnlLeft.Width = 260;
            pnlLeft.Dock = DockStyle.Left;
            pnlLeft.Padding = new Padding(10);
            pnlLeft.BackColor = Color.FromArgb(18, 18, 22);

            Label lblDisk = new Label();
            lblDisk.Text = "Archivos locales:";
            lblDisk.Dock = DockStyle.Top;
            lblDisk.Height = 30;
            lblDisk.ForeColor = Color.FromArgb(180, 180, 190);
            pnlLeft.Controls.Add(lblDisk);

            lbDiskFiles = new ListBox();
            lbDiskFiles.Dock = DockStyle.Fill;
            lbDiskFiles.BackColor = Color.FromArgb(32, 32, 38);
            lbDiskFiles.ForeColor = Color.White;
            lbDiskFiles.BorderStyle = BorderStyle.None;
            pnlLeft.Controls.Add(lbDiskFiles);

            btnAdd = new Button();
            btnAdd.Text = "➕ Agregar a Playlist";
            btnAdd.Dock = DockStyle.Bottom;
            btnAdd.Height = 40;
            btnAdd.FlatStyle = FlatStyle.Flat;
            btnAdd.BackColor = Color.FromArgb(180, 20, 50);
            btnAdd.ForeColor = Color.White;
            btnAdd.Click += new EventHandler(btnAdd_Click);
            pnlLeft.Controls.Add(btnAdd);

            Panel pnlTv = new Panel();
            pnlTv.Dock = DockStyle.Bottom;
            pnlTv.Height = 190;
            pnlTv.BackColor = Color.FromArgb(28, 28, 34);
            pnlTv.Padding = new Padding(10);
            pnlTv.Margin = new Padding(0, 10, 0, 0);

            Label lblTvTitle = new Label();
            lblTvTitle.Text = "⏰ Horario de Pantalla (TV)";
            lblTvTitle.Font = new Font("Segoe UI", 9.5F, FontStyle.Bold);
            lblTvTitle.ForeColor = Color.FromArgb(255, 51, 75);
            lblTvTitle.Location = new Point(10, 8);
            lblTvTitle.Size = new Size(220, 20);
            pnlTv.Controls.Add(lblTvTitle);

            chkTvEnabled = new CheckBox();
            chkTvEnabled.Text = "Apagado/Encendido Auto";
            chkTvEnabled.Location = new Point(10, 32);
            chkTvEnabled.Size = new Size(220, 24);
            chkTvEnabled.Font = new Font("Segoe UI", 9F, FontStyle.Regular);

            Panel pnlTvInputs = new Panel();
            pnlTvInputs.Location = new Point(10, 60);
            pnlTvInputs.Size = new Size(230, 125);

            Label lblOn = new Label();
            lblOn.Text = "Encendido:";
            lblOn.Location = new Point(0, 5);
            lblOn.Size = new Size(80, 20);
            lblOn.Font = new Font("Segoe UI", 9F);
            lblOn.ForeColor = Color.FromArgb(180, 180, 190);
            pnlTvInputs.Controls.Add(lblOn);

            txtTvOnTime = new TextBox();
            txtTvOnTime.Text = "08:00";
            txtTvOnTime.Location = new Point(90, 2);
            txtTvOnTime.Size = new Size(70, 25);
            txtTvOnTime.BackColor = Color.FromArgb(32, 32, 38);
            txtTvOnTime.ForeColor = Color.White;
            txtTvOnTime.BorderStyle = BorderStyle.FixedSingle;
            pnlTvInputs.Controls.Add(txtTvOnTime);

            Label lblOff = new Label();
            lblOff.Text = "Apagado:";
            lblOff.Location = new Point(0, 35);
            lblOff.Size = new Size(80, 20);
            lblOff.Font = new Font("Segoe UI", 9F);
            lblOff.ForeColor = Color.FromArgb(180, 180, 190);
            pnlTvInputs.Controls.Add(lblOff);

            txtTvOffTime = new TextBox();
            txtTvOffTime.Text = "20:00";
            txtTvOffTime.Location = new Point(90, 32);
            txtTvOffTime.Size = new Size(70, 25);
            txtTvOffTime.BackColor = Color.FromArgb(32, 32, 38);
            txtTvOffTime.ForeColor = Color.White;
            txtTvOffTime.BorderStyle = BorderStyle.FixedSingle;
            pnlTvInputs.Controls.Add(txtTvOffTime);

            btnTvDays = new Button();
            btnTvDays.Text = "📅 Días de TV";
            btnTvDays.Location = new Point(0, 65);
            btnTvDays.Size = new Size(100, 28);
            btnTvDays.FlatStyle = FlatStyle.Flat;
            btnTvDays.BackColor = Color.FromArgb(40, 40, 48);
            btnTvDays.ForeColor = Color.White;
            btnTvDays.FlatAppearance.BorderColor = Color.FromArgb(80, 80, 90);
            pnlTvInputs.Controls.Add(btnTvDays);

            lblTvDaysShow = new Label();
            lblTvDaysShow.Text = "lun,mar,mie,jue,vie,sab,dom";
            lblTvDaysShow.Location = new Point(0, 98);
            lblTvDaysShow.Size = new Size(220, 20);
            lblTvDaysShow.Font = new Font("Segoe UI", 8F);
            lblTvDaysShow.ForeColor = Color.FromArgb(140, 140, 150);
            pnlTvInputs.Controls.Add(lblTvDaysShow);

            btnTvDays.Click += (s, ev) => {
                using (DaysSelectionForm form = new DaysSelectionForm(tvDays))
                {
                    if (form.ShowDialog(this) == DialogResult.OK)
                    {
                        tvDays = form.SelectedDays;
                        lblTvDaysShow.Text = string.IsNullOrEmpty(tvDays) ? "Ninguno" : tvDays;
                    }
                }
            };

            chkTvEnabled.CheckedChanged += (s, ev) => {
                pnlTvInputs.Enabled = chkTvEnabled.Checked;
            };
            pnlTvInputs.Enabled = false;

            pnlTv.Controls.Add(chkTvEnabled);
            pnlTv.Controls.Add(pnlTvInputs);
            pnlLeft.Controls.Add(pnlTv);

            lblDisk.SendToBack();
            pnlTv.SendToBack();
            btnAdd.SendToBack();
            lbDiskFiles.BringToFront();

            Panel pnlMain = new Panel();
            pnlMain.Dock = DockStyle.Fill;
            pnlMain.Padding = new Padding(10);

            dgvPlaylist = new DataGridView();
            dgvPlaylist.Dock = DockStyle.Fill;
            dgvPlaylist.BackgroundColor = Color.FromArgb(32, 32, 38);
            dgvPlaylist.ForeColor = Color.White;
            dgvPlaylist.BorderStyle = BorderStyle.None;
            dgvPlaylist.AllowUserToAddRows = false;
            dgvPlaylist.RowTemplate.Height = 40;
            dgvPlaylist.ColumnHeadersHeight = 45;
            dgvPlaylist.AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.None;
            dgvPlaylist.ScrollBars = ScrollBars.Both;
            dgvPlaylist.DefaultCellStyle.BackColor = Color.FromArgb(32, 32, 38);
            dgvPlaylist.DefaultCellStyle.ForeColor = Color.White;
            dgvPlaylist.DefaultCellStyle.SelectionBackColor = Color.FromArgb(180, 20, 50);
            dgvPlaylist.DefaultCellStyle.SelectionForeColor = Color.White;
            dgvPlaylist.GridColor = Color.FromArgb(48, 48, 54);
            dgvPlaylist.ColumnHeadersDefaultCellStyle.BackColor = Color.FromArgb(48, 48, 54);
            dgvPlaylist.ColumnHeadersDefaultCellStyle.ForeColor = Color.White;
            dgvPlaylist.EnableHeadersVisualStyles = false;

            dgvPlaylist.CellValueChanged += new DataGridViewCellEventHandler(dgvPlaylist_CellValueChanged);
            dgvPlaylist.CurrentCellDirtyStateChanged += new EventHandler(dgvPlaylist_CurrentCellDirtyStateChanged);
            dgvPlaylist.CellClick += new DataGridViewCellEventHandler(dgvPlaylist_CellClick);
            pnlMain.Controls.Add(dgvPlaylist);

            Panel pnlBottom = new Panel();
            pnlBottom.Dock = DockStyle.Bottom;
            pnlBottom.Height = 50;
            pnlBottom.Padding = new Padding(0, 10, 0, 0);

            btnMoveUp = new Button();
            btnMoveUp.Text = "▲ Subir";
            btnMoveUp.Location = new Point(0, 10);
            btnMoveUp.Size = new Size(100, 35);
            btnMoveUp.FlatStyle = FlatStyle.Flat;
            btnMoveUp.BackColor = Color.FromArgb(40, 40, 48);
            btnMoveUp.Click += new EventHandler(btnMoveUp_Click);
            pnlBottom.Controls.Add(btnMoveUp);

            btnMoveDown = new Button();
            btnMoveDown.Text = "▼ Bajar";
            btnMoveDown.Location = new Point(110, 10);
            btnMoveDown.Size = new Size(100, 35);
            btnMoveDown.FlatStyle = FlatStyle.Flat;
            btnMoveDown.BackColor = Color.FromArgb(40, 40, 48);
            btnMoveDown.Click += new EventHandler(btnMoveDown_Click);
            pnlBottom.Controls.Add(btnMoveDown);

            btnRemove = new Button();
            btnRemove.Text = "✕ Quitar Seleccionado";
            btnRemove.Location = new Point(220, 10);
            btnRemove.Size = new Size(180, 35);
            btnRemove.FlatStyle = FlatStyle.Flat;
            btnRemove.BackColor = Color.FromArgb(150, 20, 30);
            btnRemove.Click += new EventHandler(btnRemove_Click);
            pnlBottom.Controls.Add(btnRemove);

            pnlMain.Controls.Add(pnlBottom);

            this.Controls.Add(pnlMain);
            this.Controls.Add(pnlLeft);
            this.Controls.Add(pnlHeader);

            pnlHeader.SendToBack();
            pnlLeft.SendToBack();
            pnlMain.BringToFront();

            SetupDgvColumns();
        }

        private void SetupDgvColumns()
        {
            dgvPlaylist.Columns.Clear();

            DataGridViewTextBoxColumn colOrder = new DataGridViewTextBoxColumn();
            colOrder.Name = "colOrder";
            colOrder.HeaderText = "Orden";
            colOrder.Width = 50;
            colOrder.ReadOnly = true;
            colOrder.DefaultCellStyle.Alignment = DataGridViewContentAlignment.MiddleCenter;
            dgvPlaylist.Columns.Add(colOrder);

            DataGridViewComboBoxColumn colLayout = new DataGridViewComboBoxColumn();
            colLayout.Name = "colLayout";
            colLayout.HeaderText = "Diseño (Layout)";
            colLayout.Width = 150;
            colLayout.Items.AddRange("fullscreen", "split_sidebar", "split_ticker", "three_regions");
            dgvPlaylist.Columns.Add(colLayout);

            DataGridViewComboBoxColumn colMainFile = new DataGridViewComboBoxColumn();
            colMainFile.Name = "colMainFile";
            colMainFile.HeaderText = "Contenido Principal";
            colMainFile.Width = 200;
            dgvPlaylist.Columns.Add(colMainFile);

            DataGridViewComboBoxColumn colSidebarFile = new DataGridViewComboBoxColumn();
            colSidebarFile.Name = "colSidebarFile";
            colSidebarFile.HeaderText = "Barra Lateral (Imagen)";
            colSidebarFile.Width = 200;
            dgvPlaylist.Columns.Add(colSidebarFile);

            DataGridViewTextBoxColumn colTickerText = new DataGridViewTextBoxColumn();
            colTickerText.Name = "colTickerText";
            colTickerText.HeaderText = "Texto Marquesina";
            colTickerText.Width = 250;
            dgvPlaylist.Columns.Add(colTickerText);

            DataGridViewTextBoxColumn colDuration = new DataGridViewTextBoxColumn();
            colDuration.Name = "colDuration";
            colDuration.HeaderText = "Duración (s)";
            colDuration.Width = 80;
            dgvPlaylist.Columns.Add(colDuration);

            DataGridViewTextBoxColumn colZoom = new DataGridViewTextBoxColumn();
            colZoom.Name = "colZoom";
            colZoom.HeaderText = "Zoom Prin (%)";
            colZoom.Width = 80;
            dgvPlaylist.Columns.Add(colZoom);

            DataGridViewTextBoxColumn colSidebarZoom = new DataGridViewTextBoxColumn();
            colSidebarZoom.Name = "colSidebarZoom";
            colSidebarZoom.HeaderText = "Zoom Lat (%)";
            colSidebarZoom.Width = 80;
            dgvPlaylist.Columns.Add(colSidebarZoom);

            DataGridViewTextBoxColumn colSchedule = new DataGridViewTextBoxColumn();
            colSchedule.Name = "colSchedule";
            colSchedule.HeaderText = "Horario";
            colSchedule.Width = 100;
            dgvPlaylist.Columns.Add(colSchedule);

            DataGridViewTextBoxColumn colDays = new DataGridViewTextBoxColumn();
            colDays.Name = "colDays";
            colDays.HeaderText = "Días Activos";
            colDays.Width = 100;
            colDays.ReadOnly = true;
            dgvPlaylist.Columns.Add(colDays);
        }

        private void SetComboValue(DataGridViewComboBoxCell cell, string value)
        {
            if (value == null) value = "";
            if (!cell.Items.Contains(value))
            {
                cell.Items.Add(value);
            }
            cell.Value = value;
        }

        private void UpdateCellStates()
        {
            foreach (DataGridViewRow row in dgvPlaylist.Rows)
            {
                if (row.IsNewRow) continue;
                string layout = Convert.ToString(row.Cells["colLayout"].Value);
                bool hasSidebar = (layout == "split_sidebar" || layout == "three_regions");
                bool hasTicker = (layout == "split_ticker" || layout == "three_regions");

                row.Cells["colSidebarFile"].ReadOnly = !hasSidebar;
                row.Cells["colSidebarZoom"].ReadOnly = !hasSidebar;
                row.Cells["colTickerText"].ReadOnly = !hasTicker;

                row.Cells["colSidebarFile"].Style.BackColor = hasSidebar ? Color.FromArgb(32, 32, 38) : Color.FromArgb(48, 48, 54);
                row.Cells["colSidebarZoom"].Style.BackColor = hasSidebar ? Color.FromArgb(32, 32, 38) : Color.FromArgb(48, 48, 54);
                row.Cells["colTickerText"].Style.BackColor = hasTicker ? Color.FromArgb(32, 32, 38) : Color.FromArgb(48, 48, 54);
            }
        }

        private void LoadFilesFromDisk()
        {
            diskFiles.Clear();
            lbDiskFiles.Items.Clear();
            if (Directory.Exists(currentDir))
            {
                foreach (string file in Directory.GetFiles(currentDir))
                {
                    string ext = Path.GetExtension(file).ToLower();
                    if (Array.IndexOf(supportedExtensions, ext) >= 0)
                    {
                        string name = Path.GetFileName(file);
                        diskFiles.Add(name);
                        lbDiskFiles.Items.Add(name);
                    }
                }
            }

            DataGridViewComboBoxColumn colMain = (DataGridViewComboBoxColumn)dgvPlaylist.Columns["colMainFile"];
            colMain.Items.Clear();
            colMain.Items.Add("");
            foreach (string f in diskFiles) colMain.Items.Add(f);

            DataGridViewComboBoxColumn colSidebar = (DataGridViewComboBoxColumn)dgvPlaylist.Columns["colSidebarFile"];
            colSidebar.Items.Clear();
            colSidebar.Items.Add("");
            foreach (string f in diskFiles)
            {
                string ext = Path.GetExtension(f).ToLower();
                if (ext != ".mp4" && ext != ".mkv" && ext != ".avi")
                {
                    colSidebar.Items.Add(f);
                }
            }
        }

        private void LoadPlaylistJson()
        {
            dgvPlaylist.Rows.Clear();
            string path = Path.Combine(currentDir, "playlist.json");
            if (File.Exists(path))
            {
                try
                {
                    string jsonText = File.ReadAllText(path);
                    PlaylistRoot root = DeserializePlaylist(jsonText);
                    
                    if (root.power_schedule != null)
                    {
                        chkTvEnabled.Checked = root.power_schedule.enabled;
                        txtTvOnTime.Text = root.power_schedule.on_time ?? "08:00";
                        txtTvOffTime.Text = root.power_schedule.off_time ?? "20:00";
                        tvDays = root.power_schedule.days ?? "lun,mar,mie,jue,vie,sab,dom";
                        lblTvDaysShow.Text = string.IsNullOrEmpty(tvDays) ? "Ninguno" : tvDays;
                    }
                    else
                    {
                        chkTvEnabled.Checked = false;
                        txtTvOnTime.Text = "08:00";
                        txtTvOffTime.Text = "20:00";
                        tvDays = "lun,mar,mie,jue,vie,sab,dom";
                        lblTvDaysShow.Text = tvDays;
                    }

                    List<PlaylistItem> list = root.items ?? new List<PlaylistItem>();
                    foreach (PlaylistItem item in list)
                    {
                        int idx = dgvPlaylist.Rows.Add();
                        DataGridViewRow row = dgvPlaylist.Rows[idx];

                        row.Cells["colOrder"].Value = idx + 1;
                        row.Cells["colLayout"].Value = string.IsNullOrEmpty(item.layout) ? "fullscreen" : item.layout;

                        string mainFile = string.IsNullOrEmpty(item.main_file) ? item.file : item.main_file;
                        SetComboValue((DataGridViewComboBoxCell)row.Cells["colMainFile"], mainFile);
                        SetComboValue((DataGridViewComboBoxCell)row.Cells["colSidebarFile"], item.sidebar_file);

                        row.Cells["colTickerText"].Value = item.ticker_text ?? "";
                        row.Cells["colDuration"].Value = item.duration.HasValue ? item.duration.Value.ToString() : "";
                        row.Cells["colZoom"].Value = item.zoom.HasValue ? item.zoom.Value.ToString() : "100";
                        row.Cells["colSidebarZoom"].Value = item.sidebar_zoom.HasValue ? item.sidebar_zoom.Value.ToString() : "100";
                        row.Cells["colSchedule"].Value = item.schedule ?? "";
                        row.Cells["colDays"].Value = item.days ?? "";
                    }
                }
                catch (Exception ex)
                {
                    MessageBox.Show("Error al cargar playlist.json: " + ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            }
            UpdateCellStates();
        }

        public static int GetVideoDuration(string filePath)
        {
            try
            {
                string dir = Path.GetDirectoryName(filePath);
                string file = Path.GetFileName(filePath);
                Type shellType = Type.GetTypeFromProgID("Shell.Application");
                object shell = Activator.CreateInstance(shellType);
                object folder = shellType.InvokeMember("NameSpace", System.Reflection.BindingFlags.InvokeMethod, null, shell, new object[] { dir });
                object folderItem = folder.GetType().InvokeMember("ParseName", System.Reflection.BindingFlags.InvokeMethod, null, folder, new object[] { file });
                string detail = (string)folder.GetType().InvokeMember("GetDetailsOf", System.Reflection.BindingFlags.InvokeMethod, null, folder, new object[] { folderItem, 27 });
                if (!string.IsNullOrEmpty(detail))
                {
                    TimeSpan ts;
                    if (TimeSpan.TryParse(detail, out ts))
                    {
                        return (int)ts.TotalSeconds;
                    }
                }
            }
            catch {}
            return 10;
        }

        private void dgvPlaylist_CellClick(object sender, DataGridViewCellEventArgs e)
        {
            if (e.RowIndex < 0 || e.ColumnIndex < 0) return;

            if (dgvPlaylist.Columns[e.ColumnIndex].Name == "colDays")
            {
                DataGridViewCell cell = dgvPlaylist.Rows[e.RowIndex].Cells[e.ColumnIndex];
                string currentVal = Convert.ToString(cell.Value);

                using (DaysSelectionForm form = new DaysSelectionForm(currentVal))
                {
                    if (form.ShowDialog(this) == DialogResult.OK)
                    {
                        cell.Value = form.SelectedDays;
                        dgvPlaylist.CommitEdit(DataGridViewDataErrorContexts.Commit);
                    }
                }
            }
        }

        private void dgvPlaylist_CellValueChanged(object sender, DataGridViewCellEventArgs e)
        {
            if (e.RowIndex < 0) return;
            DataGridViewRow row = dgvPlaylist.Rows[e.RowIndex];

            if (e.ColumnIndex == dgvPlaylist.Columns["colMainFile"].Index)
            {
                string fileVal = Convert.ToString(row.Cells["colMainFile"].Value);
                if (!string.IsNullOrEmpty(fileVal))
                {
                    string ext = Path.GetExtension(fileVal).ToLower();
                    bool isVideo = (ext == ".mp4" || ext == ".mkv" || ext == ".avi");
                    if (isVideo)
                    {
                        string fullPath = Path.Combine(currentDir, fileVal);
                        int seconds = GetVideoDuration(fullPath);
                        row.Cells["colDuration"].Value = seconds.ToString();
                    }
                    else
                    {
                        row.Cells["colDuration"].Value = "12";
                    }
                }
            }

            if (e.ColumnIndex == dgvPlaylist.Columns["colLayout"].Index)
            {
                UpdateCellStates();
            }
        }

        private void dgvPlaylist_CurrentCellDirtyStateChanged(object sender, EventArgs e)
        {
            if (dgvPlaylist.IsCurrentCellDirty)
            {
                dgvPlaylist.CommitEdit(DataGridViewDataErrorContexts.Commit);
            }
        }

        private void btnAdd_Click(object sender, EventArgs e)
        {
            if (lbDiskFiles.SelectedItem == null) return;
            string fileVal = lbDiskFiles.SelectedItem.ToString();
            int idx = dgvPlaylist.Rows.Add();
            DataGridViewRow row = dgvPlaylist.Rows[idx];

            row.Cells["colOrder"].Value = idx + 1;
            row.Cells["colLayout"].Value = "fullscreen";
            SetComboValue((DataGridViewComboBoxCell)row.Cells["colMainFile"], fileVal);
            SetComboValue((DataGridViewComboBoxCell)row.Cells["colSidebarFile"], "");
            row.Cells["colTickerText"].Value = "";
            row.Cells["colZoom"].Value = "100";
            row.Cells["colSidebarZoom"].Value = "100";
            row.Cells["colSchedule"].Value = "";
            row.Cells["colDays"].Value = "";

            string ext = Path.GetExtension(fileVal).ToLower();
            bool isVideo = (ext == ".mp4" || ext == ".mkv" || ext == ".avi");
            if (isVideo)
            {
                string fullPath = Path.Combine(currentDir, fileVal);
                int seconds = GetVideoDuration(fullPath);
                row.Cells["colDuration"].Value = seconds.ToString();
            }
            else
            {
                row.Cells["colDuration"].Value = "12";
            }

            UpdateCellStates();
        }

        private void btnRemove_Click(object sender, EventArgs e)
        {
            if (dgvPlaylist.CurrentRow == null) return;
            dgvPlaylist.Rows.Remove(dgvPlaylist.CurrentRow);
            for (int i = 0; i < dgvPlaylist.Rows.Count; i++)
            {
                dgvPlaylist.Rows[i].Cells["colOrder"].Value = i + 1;
            }
        }

        private void btnMoveUp_Click(object sender, EventArgs e)
        {
            if (dgvPlaylist.CurrentRow == null) return;
            int idx = dgvPlaylist.CurrentRow.Index;
            if (idx > 0)
            {
                DataGridViewRow row = dgvPlaylist.Rows[idx];
                dgvPlaylist.Rows.RemoveAt(idx);
                dgvPlaylist.Rows.Insert(idx - 1, row);
                dgvPlaylist.ClearSelection();
                row.Selected = true;
                dgvPlaylist.CurrentCell = row.Cells["colLayout"];

                for (int i = 0; i < dgvPlaylist.Rows.Count; i++)
                {
                    dgvPlaylist.Rows[i].Cells["colOrder"].Value = i + 1;
                }
            }
        }

        private void btnMoveDown_Click(object sender, EventArgs e)
        {
            if (dgvPlaylist.CurrentRow == null) return;
            int idx = dgvPlaylist.CurrentRow.Index;
            if (idx < dgvPlaylist.Rows.Count - 1)
            {
                DataGridViewRow row = dgvPlaylist.Rows[idx];
                dgvPlaylist.Rows.RemoveAt(idx);
                dgvPlaylist.Rows.Insert(idx + 1, row);
                dgvPlaylist.ClearSelection();
                row.Selected = true;
                dgvPlaylist.CurrentCell = row.Cells["colLayout"];

                for (int i = 0; i < dgvPlaylist.Rows.Count; i++)
                {
                    dgvPlaylist.Rows[i].Cells["colOrder"].Value = i + 1;
                }
            }
        }

        private void btnRefresh_Click(object sender, EventArgs e)
        {
            LoadFilesFromDisk();
            LoadPlaylistJson();
            MessageBox.Show("Archivos de disco y lista de reproducción actualizados.", "Información", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }

        private void btnSave_Click(object sender, EventArgs e)
        {
            List<PlaylistItem> list = new List<PlaylistItem>();
            foreach (DataGridViewRow row in dgvPlaylist.Rows)
            {
                if (row.IsNewRow) continue;
                PlaylistItem item = new PlaylistItem();
                item.layout = Convert.ToString(row.Cells["colLayout"].Value);
                string mainF = Convert.ToString(row.Cells["colMainFile"].Value);
                item.main_file = mainF;
                item.file = mainF;
                item.sidebar_file = Convert.ToString(row.Cells["colSidebarFile"].Value);
                item.ticker_text = Convert.ToString(row.Cells["colTickerText"].Value);

                string durVal = Convert.ToString(row.Cells["colDuration"].Value);
                int tempDur;
                if (int.TryParse(durVal, out tempDur)) item.duration = tempDur;
                else item.duration = null;

                string zoomVal = Convert.ToString(row.Cells["colZoom"].Value);
                int tempZoom;
                if (int.TryParse(zoomVal, out tempZoom)) item.zoom = tempZoom;
                else item.zoom = 100;

                string sideZoomVal = Convert.ToString(row.Cells["colSidebarZoom"].Value);
                int tempSideZoom;
                if (int.TryParse(sideZoomVal, out tempSideZoom)) item.sidebar_zoom = tempSideZoom;
                else item.sidebar_zoom = 100;

                string sched = Convert.ToString(row.Cells["colSchedule"].Value);
                item.schedule = string.IsNullOrEmpty(sched) ? null : sched;

                string daysVal = Convert.ToString(row.Cells["colDays"].Value);
                item.days = string.IsNullOrEmpty(daysVal) ? null : daysVal;

                list.Add(item);
            }

            PlaylistRoot root = new PlaylistRoot();
            root.power_schedule = new PowerSchedule
            {
                enabled = chkTvEnabled.Checked,
                on_time = txtTvOnTime.Text,
                off_time = txtTvOffTime.Text,
                days = tvDays
            };
            root.items = list;

            try
            {
                string jsonText = SerializePlaylist(root);
                File.WriteAllText(Path.Combine(currentDir, "playlist.json"), jsonText, Encoding.UTF8);
                MessageBox.Show("playlist.json guardado con éxito.", "Éxito", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Error al guardar: " + ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private string SerializePlaylist(PlaylistRoot root)
        {
            using (MemoryStream ms = new MemoryStream())
            {
                DataContractJsonSerializer ser = new DataContractJsonSerializer(typeof(PlaylistRoot));
                ser.WriteObject(ms, root);
                string rawJson = Encoding.UTF8.GetString(ms.ToArray());
                return rawJson.Replace("},\"", "},\n  \"")
                              .Replace(",\"items\":", ",\n  \"items\":")
                              .Replace(",\"power_schedule\":", ",\n  \"power_schedule\":")
                              .Replace("},{", "},\n    {")
                              .Replace("[{", "[\n    {")
                              .Replace("}]", "}\n  ]");
            }
        }

        private PlaylistRoot DeserializePlaylist(string json)
        {
            using (MemoryStream ms = new MemoryStream(Encoding.UTF8.GetBytes(json)))
            {
                try
                {
                    DataContractJsonSerializer ser = new DataContractJsonSerializer(typeof(PlaylistRoot));
                    return (PlaylistRoot)ser.ReadObject(ms);
                }
                catch
                {
                    using (MemoryStream msFallback = new MemoryStream(Encoding.UTF8.GetBytes(json)))
                    {
                        DataContractJsonSerializer serList = new DataContractJsonSerializer(typeof(List<PlaylistItem>));
                        List<PlaylistItem> list = (List<PlaylistItem>)serList.ReadObject(msFallback);
                        return new PlaylistRoot
                        {
                            power_schedule = new PowerSchedule { enabled = false },
                            items = list
                        };
                    }
                }
            }
        }

        [STAThread]
        public static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new PlaylistForm());
        }
    }

    public class DaysSelectionForm : Form
    {
        private CheckBox[] checkBoxes;
        private Button btnOk;
        private Button btnCancel;
        
        public string SelectedDays { get; set; }

        public DaysSelectionForm(string initialDays)
        {
            this.Text = "Seleccionar Días Activos";
            this.Size = new Size(300, 380);
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.MinimizeBox = false;
            this.StartPosition = FormStartPosition.CenterParent;
            this.BackColor = Color.FromArgb(24, 24, 28);
            this.ForeColor = Color.White;
            this.Font = new Font("Segoe UI", 10F);

            string[] dayIds = new string[] { "lun", "mar", "mie", "jue", "vie", "sab", "dom" };
            string[] dayNames = new string[] { "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo" };

            checkBoxes = new CheckBox[7];
            
            List<string> activeDays = new List<string>();
            if (!string.IsNullOrEmpty(initialDays))
            {
                foreach (string d in initialDays.Split(','))
                {
                    activeDays.Add(d.Trim().ToLower());
                }
            }

            for (int i = 0; i < 7; i++)
            {
                checkBoxes[i] = new CheckBox();
                checkBoxes[i].Text = dayNames[i];
                checkBoxes[i].Tag = dayIds[i];
                checkBoxes[i].Location = new Point(30, 20 + (i * 35));
                checkBoxes[i].Size = new Size(200, 25);
                checkBoxes[i].Checked = activeDays.Contains(dayIds[i]);
                this.Controls.Add(checkBoxes[i]);
            }

            btnOk = new Button();
            btnOk.Text = "Aceptar";
            btnOk.Location = new Point(30, 280);
            btnOk.Size = new Size(100, 35);
            btnOk.FlatStyle = FlatStyle.Flat;
            btnOk.BackColor = Color.FromArgb(10, 130, 80);
            btnOk.ForeColor = Color.White;
            btnOk.Click += (s, e) => {
                List<string> selected = new List<string>();
                for (int i = 0; i < 7; i++)
                {
                    if (checkBoxes[i].Checked)
                    {
                        selected.Add((string)checkBoxes[i].Tag);
                    }
                }
                SelectedDays = selected.Count > 0 ? string.Join(",", selected.ToArray()) : "";
                this.DialogResult = DialogResult.OK;
                this.Close();
            };
            this.Controls.Add(btnOk);

            btnCancel = new Button();
            btnCancel.Text = "Cancelar";
            btnCancel.Location = new Point(150, 280);
            btnCancel.Size = new Size(100, 35);
            btnCancel.FlatStyle = FlatStyle.Flat;
            btnCancel.BackColor = Color.FromArgb(40, 40, 48);
            btnCancel.ForeColor = Color.White;
            btnCancel.Click += (s, e) => {
                this.DialogResult = DialogResult.Cancel;
                this.Close();
            };
            this.Controls.Add(btnCancel);
        }
    }
}