const app = (() => {
    // ========================
    // 1. 常量与DOM引用 / Constants & DOM References
    // ========================
    // 从本地存储加载班级数据，如果不存在则初始化为空数组
    const classes = JSON.parse(localStorage.getItem('classes')) || [];
    
    // 考勤类别定义：category-类别名称, score-分数权重, areaType-区域类型(0-普通, 1-请假)
    const attendanceCategories = [
        { category: '加', score: -1, areaType: 0 }, // 加分项
        { category: '迟', score: 1, areaType: 0 },  // 迟到
        { category: '假', score: 1, areaType: 1 },  // 请假(特殊区域)
        { category: '旷', score: 5, areaType: 0 },  // 旷课
        { category: '睡', score: 2, areaType: 0 },  // 睡觉
        { category: '玩', score: 2, areaType: 0 }   // 玩手机等
    ];
    
    // DOM元素引用
    const classMode = document.getElementById("classMode");         // 班级选择下拉框
    const studentList = document.getElementById("studentList");     // 学生列表容器
    const rollCallBtn = document.getElementById("rollCallBtn");     // 点名按钮
    const rollCallResult = document.getElementById("rollCallResult"); // 点名结果显示区
    const seatLayout = document.getElementById("seatLayout");       // 座位布局容器
    const attendanceArea = document.getElementById("attendanceArea"); // 考勤区域容器
    const dateToday = document.getElementById("dateToday");         // 日期选择器
    const rowInput = document.getElementById("rowInput");           // 行数输入框
    const colInput = document.getElementById("colInput");           // 列数输入框
    const aisleInput = document.getElementById("aisleInput");       // 过道位置输入框
    const createLayoutBtn = document.getElementById("createLayoutBtn"); // 创建布局按钮
    
    // 配置变量
    let rows = 11;                                   // 座位行数(默认7行)
    let columns = 12;                                // 座位列数(默认8列)
    let aisleColumns = [];                           // 过道列位置数组
    let studentElementMap = new Map();              // 学生姓名到DOM元素的映射，用于快速查找

    // ========================
    // 2. 初始化函数 / Initialization Functions
    // ========================

    /**
     * 初始化日期选择器为当天日期
     */
    function initDate() {
        dateToday.value = new Date().toISOString().split('T')[0];
    }

    /**
     * 初始化班级选择下拉菜单，根据本地存储的班级数据填充选项
     */
    function initClassSelection() {
        classes.forEach(cls => {
            const option = document.createElement("option");
            option.value = cls.class;
            option.textContent = cls.class;
            classMode.appendChild(option);
        });
    }

    /**
     * 初始化学生列表显示
     * @param {Array} students - 学生姓名数组
     */
    function initStudentList(students) {
        studentList.innerHTML = "";                 // 清空现有列表
        studentElementMap.clear();                  // 清空学生元素映射
        
        students.forEach(student => {
            const studentDiv = createStudentDiv(student);
            studentDiv.disabled = true;             // 初始状态设为禁用
            studentList.appendChild(studentDiv);
            studentElementMap.set(student, studentDiv); // 存储学生姓名到元素的映射
        });
    }

    /**
     * 清空考勤区域中的所有学生
     * @param {HTMLElement} area - 要清空的考勤区域元素
     */
    function clearAttendanceArea(area) {
        const studentsInCategory = area.querySelectorAll(".student"); // 获取区域内所有学生
        
        studentsInCategory.forEach(studentInCategory => {
            const parent = studentInCategory.parentElement;
            const areaType = parent.getAttribute('data-area-type');
            const studentName = studentInCategory.textContent;

            // 如果是从请假区移除，需要恢复学生列表中的状态
            if (areaType === '1') {
                const studentInList = studentElementMap.get(studentName);
                if (studentInList) {
                    studentInList.classList.remove('disabled'); // 移除禁用样式
                    studentInList.draggable = true;            // 恢复可拖动状态
                }
            }
            studentInCategory.remove();                        // 从考勤区移除学生元素
        });
    }

    /**
     * 初始化班级，加载学生列表和座位布局
     */
    function initClass() {
        const selectedClass = classes.find(cls => cls.class === classMode.value);
        if (selectedClass) {
            initStudentList(selectedClass.name);    // 初始化学生列表
        }
        initSeatLayout();                           // 初始化座位布局
        initDate();                                 // 初始化日期
        rollCallResult.textContent = "";            // 清空点名结果
    }

    /**
     * 初始化座位布局，创建网格并设置特殊座位和过道
     */
    function initSeatLayout() {
        seatLayout.innerHTML = "";                  // 清空现有座位
        
        // 计算实际网格列数（包含过道）
        const actualColumns = columns + aisleColumns.length;
        seatLayout.style.gridTemplateColumns = `repeat(${actualColumns}, 1fr)`; // 设置网格列数
        
        // 创建座位布局
        for (let row = 1; row <= rows; row++) {
            let gridColumn = 1;
            
            for (let col = 1; col <= columns; col++) {
                // 检查在当前列之前是否需要插入过道
                if (aisleColumns.includes(col)) {
                    // 创建过道元素
                    const aisle = document.createElement("div");
                    aisle.className = "aisle";
                    seatLayout.appendChild(aisle);
                    gridColumn++;
                }
                
                // 创建座位
                const seat = document.createElement("div");
                seat.className = "seat";
                seat.textContent = "";
                
                // 计算当前座位的行号（从底部开始为第1行）
                const currentRow = rows - row + 1;
                
                // 在座位中心添加行号标记
                const rowNumberLabel = document.createElement('span');
                rowNumberLabel.className = 'row-number';
                rowNumberLabel.textContent = currentRow;
                seat.appendChild(rowNumberLabel);
                
                // 设置特殊座位样式（根据列数不同有不同规则）
                if ((columns === 8 && col <= 4) || 
                    (columns === 10 && (col <= 2 || col > columns - 2)) ||
                    (columns !== 8 && columns !== 10 && col <= Math.floor(columns / 2))) {
                    seat.classList.add('special-seat');
                }
                
                seatLayout.appendChild(seat);
                gridColumn++;
            }
        }
        
        clearAttendanceArea(attendanceArea);        // 清空考勤区域
    }

    /**
     * 初始化考勤区域，创建各类别的标题和容器
     */
    function initAttendanceArea() {
        const attendanceTitle = document.querySelector('.attendance-title');
        attendanceTitle.innerHTML = '';             // 清空标题区
        attendanceArea.innerHTML = '';              // 清空考勤区
        
        // 为每个考勤类别创建标题和容器
        attendanceCategories.forEach(item => {
            // 创建标题
            const h3 = document.createElement('h3');
            h3.textContent = item.category;
            attendanceTitle.appendChild(h3);
            
            // 创建对应的考勤类别容器
            const div = document.createElement('div');
            div.className = 'attendance-category';
            div.setAttribute('data-area-type', item.areaType); // 存储区域类型(0-普通, 1-请假)
            attendanceArea.appendChild(div);
        });
    }

    /**
     * 更新座位的行号显示状态
     * @param {HTMLElement} seat - 座位元素
     */
    function updateRowNumberVisibility(seat) {
        const hasStudent = seat.querySelector('.student') !== null;
        if (hasStudent) {
            seat.classList.add('has-student');
        } else {
            seat.classList.remove('has-student');
        }
    }

    /**
     * 解析过道位置配置
     * @param {string} aisleInput - 过道位置输入字符串，如 "2,6,9"
     * @param {number} totalColumns - 总列数
     * @returns {Array} - 过道列号数组
     */
    function parseAisleConfiguration(aisleInput, totalColumns) {
        if (!aisleInput || !aisleInput.trim()) {
            return [];
        }
        
        const aisles = aisleInput.split(',').map(s => {
            const num = parseInt(s.trim());
            return isNaN(num) ? null : num;
        }).filter(num => num !== null && num >= 1 && num <= totalColumns);
        
        return [...new Set(aisles)]; // 去重
    }

    /**
     * 根据用户输入创建自定义座位布局
     */
    function createCustomLayout() {
        const newRows = parseInt(rowInput.value);
        const newColumns = parseInt(colInput.value);
        const aisleConfigInput = aisleInput.value.trim();
        
        // 验证输入
        if (newRows < 1 || newRows > 15 || newColumns < 1 || newColumns > 15) {
            alert('行数和列数必须在1-15之间');
            return;
        }
        
        // 解析过道配置
        const newAisleColumns = parseAisleConfiguration(aisleConfigInput, newColumns);
        
        // 验证过道配置
        if (newAisleColumns.length > 0) {
            const maxAisle = Math.max(...newAisleColumns);
            if (maxAisle > newColumns) {
                alert(`过道列号 ${maxAisle} 超出了总列数 ${newColumns}`);
                return;
            }
        }
        
        // 更新配置
        rows = newRows;
        columns = newColumns;
        aisleColumns = newAisleColumns;
        
        // 保存当前布局配置到localStorage
        saveLayoutConfig();
        
        // 重新初始化布局
        initClass();
        
        const aisleInfo = aisleColumns.length > 0 ? `，过道位置: ${aisleColumns.join(', ')}` : '';
        alert(`已创建 ${rows} 行 ${columns} 列的座位布局${aisleInfo}`);
    }

    /**
     * 保存当前布局配置到localStorage
     */
    function saveLayoutConfig() {
        const layoutConfig = {
            rows: rows,
            columns: columns,
            aisleColumns: aisleColumns
        };
        localStorage.setItem('currentLayoutConfig', JSON.stringify(layoutConfig));
    }

    /**
     * 从localStorage加载布局配置
     */
    function loadLayoutConfig() {
        const savedConfig = localStorage.getItem('currentLayoutConfig');
        if (savedConfig) {
            try {
                const layoutConfig = JSON.parse(savedConfig);
                if (layoutConfig.rows && layoutConfig.columns) {
                    rows = layoutConfig.rows;
                    columns = layoutConfig.columns;
                    aisleColumns = layoutConfig.aisleColumns || [];
                    
                    // 更新输入框的值
                    rowInput.value = rows;
                    colInput.value = columns;
                    aisleInput.value = aisleColumns.join(', ');
                    
                    return true; // 表示成功加载了配置
                }
            } catch (error) {
                console.error('加载布局配置失败:', error);
            }
        }
        return false; // 表示没有加载配置
    }

    // ========================
    // 3. 拖放功能 / Drag and Drop Functionality
    // ========================
    let draggedStudent;

    function dragStart(event) {
        if (event.target.classList.contains('student')) {
            draggedStudent = event.target;
        } else {
            event.preventDefault();
        }
    }

    function dragOver(event) {
        event.preventDefault();
    }

    function drop(event) {
        try {
            event.preventDefault();
            if (!draggedStudent) return;

            const studentName = draggedStudent.textContent;
            let target = event.target;

            if (target.parentElement.classList.contains('attendance-category')) {
                target = target.parentElement;
            }

            // 拖动到座位区域
            if (target.classList.contains('seat') && 
                !target.classList.contains('aisle') && // 不能拖动到过道位置
                !draggedStudent.parentElement.classList.contains("attendance-category")) {

                if (draggedStudent.parentElement.id === 'studentList') {
                    const div = createStudentDiv(studentName);
                    target.appendChild(div);
                    updateRowNumberVisibility(target); // 更新行号显示

                    const studentInList = studentElementMap.get(studentName);
                    if (studentInList) {
                        studentInList.draggable = false;
                        studentInList.classList.add('disabled');
                    }
                } else {
                    const sourceParent = draggedStudent.parentElement;
                    target.appendChild(draggedStudent);
                    updateRowNumberVisibility(target);      // 更新目标座位
                    updateRowNumberVisibility(sourceParent); // 更新源座位
                }
            }
            // 座位上已有学生，交换位置（不能与过道交换）
            else if (target.parentElement.classList.contains("seat") && 
                     !target.parentElement.classList.contains("aisle") &&
                     draggedStudent.parentElement.classList.contains("seat") &&
                     !draggedStudent.parentElement.classList.contains("aisle")) {

                const existingStudentName = target.textContent;
                const existingStudentDiv = createStudentDiv(existingStudentName);
                const sourceParent = draggedStudent.parentElement;

                sourceParent.appendChild(existingStudentDiv);
                target.parentElement.appendChild(draggedStudent);
                target.remove();
                
                // 更新两个座位的行号显示
                updateRowNumberVisibility(sourceParent);
                updateRowNumberVisibility(target.parentElement);
            }
            // 拖动到考勤区域
            else if (target.parentElement.id === "attendanceArea") {
                const areaType = target.getAttribute('data-area-type');

                if (areaType === "1" && draggedStudent.parentElement.id === 'studentList') {
                    draggedStudent.classList.add('disabled');
                } else if (areaType === "1") {
                    draggedStudent.remove();

                    const studentInList = studentElementMap.get(studentName);
                    if (studentInList) {
                        studentInList.classList.add('disabled');
                    }
                }

                const div = createStudentDiv(studentName);
                target.appendChild(div);
            }
            // 拖动到垃圾桶（删除）
            else if (target.id === 'trashBin') {
                const sourceParent = draggedStudent.parentElement;
                
                // 如果是从座位或请假区拖到垃圾桶，恢复学生列表状态
                if (sourceParent.classList.contains("seat") || 
                    sourceParent.getAttribute('data-area-type') === "1") {
                    
                    const studentInList = studentElementMap.get(studentName);
                    if (studentInList) {
                        studentInList.draggable = true;        // 恢复可拖动
                        studentInList.classList.remove('disabled'); // 移除禁用样式
                    }
                    
                    // 如果是从座位移除，更新座位行号显示
                    if (sourceParent.classList.contains("seat")) {
                        updateRowNumberVisibility(sourceParent);
                    }
                }
                
                // 从学生列表拖到垃圾桶
                if (sourceParent.id === 'studentList') {
                    draggedStudent.classList.add('disabled');  // 添加禁用样式
                } else {
                    // 从座位或考勤区拖来，直接移除
                    draggedStudent.remove();
                }
            }
            // 拖回学生列表区域
            else if (target.id === 'studentList' || target.parentElement.id === 'studentList') {
                const sourceParent = draggedStudent.parentElement;

                if (sourceParent.classList.contains("seat") || 
                    sourceParent.getAttribute('data-area-type') === "1") {

                    const studentInList = studentElementMap.get(studentName);
                    if (studentInList) {
                        studentInList.draggable = true;
                        studentInList.classList.remove('disabled');
                    }
                    
                    // 如果是从座位移除，更新座位行号显示
                    if (sourceParent.classList.contains("seat")) {
                        updateRowNumberVisibility(sourceParent);
                    }
                }

                if (sourceParent.id !== 'studentList') {
                    draggedStudent.remove();
                }
            }
        } catch (error) {
            console.error("拖拽事件处理失败:", error);
            draggedStudent = null;
        }
    }

    // ========================
    // 4. 点名功能 / Roll Call Functionality
    // ========================

    function handleRollCall() {
        const selectedClass = classMode.value;
        if (!selectedClass) {
            rollCallResult.textContent = "请先选择班级";
            return;
        }

        const classData = classes.find(cls => cls.class === selectedClass);
        if (classData && classData.name.length > 0) {
            const randomIndex = Math.floor(Math.random() * classData.name.length);
            rollCallResult.textContent = classData.name[randomIndex];
        } else {
            rollCallResult.textContent = "没有学生可点名";
        }
    }

    // ========================
    // 5. 考勤管理 / Attendance Management
    // ========================

    /**
     * 保存当前考勤记录到本地存储
     */
    function saveAttendance() {
        const selectedClass = classMode.value;
        if (!selectedClass) {
            alert('请先选择班级');
            return;
        }

        // 获取当前日期
        const currentDate = dateToday.value;

        // 构建考勤数据对象
        const attendanceData = {
            date: currentDate,
            attendance: {}
        };

        // 收集各类别的考勤学生
        attendanceCategories.forEach(item => {
            attendanceData.attendance[item.category] = getAttendanceStudents(item.category);
        });

        // 获取班级历史考勤记录
        const classRecords = JSON.parse(localStorage.getItem(selectedClass)) || [];
        const existingRecordIndex = classRecords.findIndex(record => record.date === currentDate);

        // 更新或添加考勤记录
        if (existingRecordIndex !== -1) {
            classRecords[existingRecordIndex] = attendanceData; // 更新现有记录
        } else {
            classRecords.push(attendanceData);                  // 添加新记录
        }

        // 保存到本地存储
        localStorage.setItem(selectedClass, JSON.stringify(classRecords));

        // 确保基础数据也已保存
        if (!localStorage.getItem('classes')) {
            localStorage.setItem('classes', JSON.stringify(classes));
        }
        localStorage.setItem('attendanceCategories', JSON.stringify(attendanceCategories));

        // 同时保存当前座位布局（独立存储）
        saveSeatLayout();

        // 导出数据到剪贴板
        exportDataToClipboard(selectedClass);

        alert('出勤记录和座位布局已保存，数据已复制到剪贴板！');
    }

    /**
     * 保存当前座位布局到本地存储（独立于考勤记录）
     */
    function saveSeatLayout() {
        const selectedClass = classMode.value;
        if (!selectedClass) return;
        
        // 获取所有座位上的学生
        const seats = seatLayout.querySelectorAll('.seat');
        const seatData = [];
        
        seats.forEach((seat, index) => {
            const student = seat.querySelector('.student');
            if (student) {
                // 计算行列位置 (从0开始的索引转为从1开始的行列)
                const row = rows - Math.floor(index / columns);
                const col = (index % columns) + 1;
                
                seatData.push({
                    name: student.textContent,
                    row: row,
                    col: col
                });
            }
        });
        
        // 保存座位数据（只保存最新的，不保存历史记录）
        const seatLayoutKey = `${selectedClass}_seatLayout`;
        localStorage.setItem(seatLayoutKey, JSON.stringify({
            rows: rows,
            columns: columns,
            seats: seatData
        }));
    }

    /**
     * 获取当前座位布局数据（从UI中实时获取）
     * @returns {Object|null} - 当前座位布局数据或null
     */
    function getCurrentSeatLayout() {
        const selectedClass = classMode.value;
        if (!selectedClass) return null;
        
        // 获取所有座位上的学生
        const seats = seatLayout.querySelectorAll('.seat');
        const seatData = [];
        
        seats.forEach((seat, index) => {
            const student = seat.querySelector('.student');
            if (student) {
                // 计算行列位置 (从0开始的索引转为从1开始的行列)
                const row = rows - Math.floor(index / columns);
                const col = (index % columns) + 1;
                
                seatData.push({
                    name: student.textContent,
                    row: row,
                    col: col
                });
            }
        });
        
        if (seatData.length === 0) return null;
        
        return {
            rows: rows,
            columns: columns,
            seats: seatData
        };
    }
    
    /**
     * 获取当前考勤数据（从UI中实时获取）
     * @returns {Object} - 当前考勤数据
     */
    function getCurrentAttendanceData() {
        const selectedClass = classMode.value;
        if (!selectedClass) return null;
        
        // 获取当前日期
        const currentDate = dateToday.value;
        
        // 构建考勤数据对象
        const attendanceData = {
            date: currentDate,
            attendance: {}
        };
        
        // 收集各类别的考勤学生
        attendanceCategories.forEach(item => {
            attendanceData.attendance[item.category] = getAttendanceStudents(item.category);
        });
        
        return attendanceData;
    }
    
    /**
     * 导出数据到剪贴板（优化版本，减少字符数）
     * @param {string} selectedClass - 班级名称
     */
    function exportDataToClipboard(selectedClass) {
        try {
            console.log('开始导出当前会话数据（优化版本）...');
            
            // 获取当前座位布局（从 UI 实时获取）
            const currentSeatLayout = getCurrentSeatLayout();
            
            // 获取当前考勤数据（从 UI 实时获取）
            const currentAttendanceData = getCurrentAttendanceData();
            
            // 创建紧凑的导出格式
            const compactData = createCompactExportFormat(selectedClass, currentSeatLayout, currentAttendanceData);
            
            // 检查数据大小并选择合适的格式
            const plainTextLength = compactData.length;
            console.log('明文数据长度:', plainTextLength);
            
            let exportCode;
            if (plainTextLength <= 2800) {
                // 使用明文格式（便于阅读和传输）
                exportCode = `SEAT_TXT_v1:${compactData}`;
                console.log('使用明文格式，总长度:', exportCode.length);
            } else {
                // 数据仍然太长，使用超紧凑二进制格式
                const binaryData = createBinaryExportFormat(selectedClass, currentSeatLayout, currentAttendanceData);
                exportCode = `SEAT_BIN_v1:${binaryData}`;
                console.log('使用二进制格式，总长度:', exportCode.length);
            }
            
            // 复制到剪贴板
            navigator.clipboard.writeText(exportCode).then(() => {
                console.log('数据已复制到剪贴板');
                //alert(`数据已复制到剪贴板！\n格式: ${exportCode.startsWith('SEAT_TXT_v1:') ? '明文' : '二进制'}\n长度: ${exportCode.length} 字符`);
            }).catch(err => {
                console.error('复制失败:', err);
                // 备用方案：显示在弹窗中
                showExportModal(exportCode);
            });
            
        } catch (error) {
            console.error('导出数据失败:', error);
            alert('导出数据失败，请重试');
        }
    }

    /**
     * 创建紧凑的明文导出格式
     * @param {string} className - 班级名称
     * @param {Object} seatLayout - 座位布局
     * @param {Object} attendanceData - 考勤数据
     * @returns {string} - 紧凑的明文字符串
     */
    function createCompactExportFormat(className, seatLayout, attendanceData) {
        const parts = [];
        
        // 1. 基本信息（班级|日期|布局尺寸）
        const date = attendanceData ? attendanceData.date : new Date().toISOString().split('T')[0];
        const layoutInfo = seatLayout ? `${seatLayout.rows}x${seatLayout.columns}` : `${rows}x${columns}`;
        parts.push(`${className}|${date}|${layoutInfo}`);
        
        // 2. 座位布局（紧凑格式：行,列:姓名索引）
        if (seatLayout && seatLayout.seats && seatLayout.seats.length > 0) {
            const classData = classes.find(cls => cls.class === className);
            const nameMap = new Map();
            if (classData) {
                classData.name.forEach((name, index) => nameMap.set(name, index));
            }
            
            const seatEntries = seatLayout.seats
                .map(seat => `${seat.row},${seat.col}:${nameMap.get(seat.name) ?? '?'}`)
                .join(';');
            parts.push(`S:${seatEntries}`);
        } else {
            parts.push('S:');
        }
        
        // 3. 考勤数据（紧凑格式：类别:姓名索引列表）
        if (attendanceData && attendanceData.attendance) {
            const classData = classes.find(cls => cls.class === className);
            const nameMap = new Map();
            if (classData) {
                classData.name.forEach((name, index) => nameMap.set(name, index));
            }
            
            const attendanceEntries = [];
            attendanceCategories.forEach(category => {
                const categoryStudents = attendanceData.attendance[category.category] || [];
                if (categoryStudents.length > 0) {
                    const indices = categoryStudents
                        .map(name => nameMap.get(name) ?? '?')
                        .filter(idx => idx !== '?')
                        .join(',');
                    if (indices) {
                        attendanceEntries.push(`${category.category}:${indices}`);
                    }
                }
            });
            parts.push(`A:${attendanceEntries.join(';')}`);
        } else {
            parts.push('A:');
        }
        
        return parts.join('|');
    }

    /**
     * 创建超紧凑的二进制导出格式
     * @param {string} className - 班级名称
     * @param {Object} seatLayout - 座位布局
     * @param {Object} attendanceData - 考勤数据
     * @returns {string} - Base64编码的二进制数据
     */
    function createBinaryExportFormat(className, seatLayout, attendanceData) {
        // 使用更激进的压缩策略：只保存关键数据
        const minimalData = {
            c: className,
            d: attendanceData ? attendanceData.date : new Date().toISOString().split('T')[0],
            r: seatLayout ? seatLayout.rows : rows,
            o: seatLayout ? seatLayout.columns : columns
        };
        
        // 座位数据：只保存有学生的座位
        if (seatLayout && seatLayout.seats && seatLayout.seats.length > 0) {
            const classData = classes.find(cls => cls.class === className);
            if (classData) {
                const nameMap = new Map();
                classData.name.forEach((name, index) => nameMap.set(name, index));
                
                minimalData.s = seatLayout.seats.map(seat => [
                    seat.row,
                    seat.col,
                    nameMap.get(seat.name) ?? -1
                ]).filter(seat => seat[2] !== -1);
            }
        }
        
        // 考勤数据：只保存有学生的类别
        if (attendanceData && attendanceData.attendance) {
            const classData = classes.find(cls => cls.class === className);
            if (classData) {
                const nameMap = new Map();
                classData.name.forEach((name, index) => nameMap.set(name, index));
                
                minimalData.a = {};
                attendanceCategories.forEach((category, catIndex) => {
                    const categoryStudents = attendanceData.attendance[category.category] || [];
                    if (categoryStudents.length > 0) {
                        const indices = categoryStudents
                            .map(name => nameMap.get(name))
                            .filter(idx => idx !== undefined);
                        if (indices.length > 0) {
                            minimalData.a[catIndex] = indices;
                        }
                    }
                });
            }
        }
        
        // 转换为JSON并压缩
        const jsonString = JSON.stringify(minimalData);
        return btoa(jsonString);
    }

    /**
     * 解析紧凑明文格式
     */
    function parseCompactTextFormat(compactData) {
        const parts = compactData.split('|');
        if (parts.length < 3) {
            throw new Error('明文数据格式错误，数据不完整');
        }
        
        // 解析基本信息: parts[0]=className, parts[1]=date, parts[2]=layoutInfo
        const className = parts[0];
        const date = parts[1];
        const layoutInfo = parts[2];
        const [rowsStr, columnsStr] = layoutInfo.split('x');
        
        const result = {
            className: className,
            currentAttendance: { date: date, attendance: {} },
            currentSeatLayout: { rows: parseInt(rowsStr), columns: parseInt(columnsStr), seats: [] }
        };
        
        const classData = classes.find(cls => cls.class === className);
        if (!classData) throw new Error(`找不到班级 ${className} 的数据`);
        
        // 解析座位数据
        const seatPart = parts.find(p => p.startsWith('S:'));
        if (seatPart && seatPart !== 'S:') {
            const seatData = seatPart.substring(2);
            if (seatData) {
                seatData.split(';').forEach(entry => {
                    if (entry) {
                        const [position, nameIndex] = entry.split(':');
                        if (position && nameIndex !== undefined) {
                            const [row, col] = position.split(',').map(n => parseInt(n));
                            const index = parseInt(nameIndex);
                            if (index >= 0 && index < classData.name.length) {
                                result.currentSeatLayout.seats.push({
                                    name: classData.name[index], row: row, col: col
                                });
                            }
                        }
                    }
                });
            }
        }
        
        // 解析考勤数据
        const attendancePart = parts.find(p => p.startsWith('A:'));
        if (attendancePart && attendancePart !== 'A:') {
            const attendanceData = attendancePart.substring(2);
            if (attendanceData) {
                attendanceData.split(';').forEach(entry => {
                    if (entry) {
                        const [category, indicesStr] = entry.split(':');
                        if (category && indicesStr) {
                            const students = indicesStr.split(',').map(n => parseInt(n))
                                .filter(i => i >= 0 && i < classData.name.length)
                                .map(i => classData.name[i]);
                            if (students.length > 0) {
                                result.currentAttendance.attendance[category] = students;
                            }
                        }
                    }
                });
            }
        }
        
        return result;
    }
    
    /**
     * 恢复座位布局到UI（不依赖localStorage）
     * @param {Object} seatLayoutData - 座位布局数据
     */
    function restoreSeatLayoutToUI(seatLayoutData) {
        if (!seatLayoutData || !seatLayoutData.seats) {
            console.log('没有座位布局数据可恢复');
            return;
        }
        
        console.log('开始恢复座位布局到UI...');
        
        // 如果保存的尺寸与当前不同，先调整尺寸
        if (seatLayoutData.rows !== rows || seatLayoutData.columns !== columns) {
            rows = seatLayoutData.rows || rows;
            columns = seatLayoutData.columns || columns;
            
            // 更新输入框的值
            rowInput.value = rows;
            colInput.value = columns;
            
            // 重新初始化座位布局
            initSeatLayout();
        }
        
        // 清空现有座位上的学生
        const seatsWithStudents = seatLayout.querySelectorAll('.seat .student');
        seatsWithStudents.forEach(student => student.remove());
        
        // 恢复所有学生状态
        const selectedClassData = classes.find(cls => cls.class === classMode.value);
        if (selectedClassData) {
            selectedClassData.name.forEach(studentName => {
                const studentInList = studentElementMap.get(studentName);
                if (studentInList) {
                    studentInList.classList.remove('disabled');
                    studentInList.draggable = true;
                }
            });
        }
        
        // 填充座位
        const seats = seatLayout.querySelectorAll('.seat');
        seatLayoutData.seats.forEach(seatInfo => {
            // 计算座位索引
            const seatIndex = (rows - seatInfo.row) * columns + (seatInfo.col - 1);
            
            if (seatIndex >= 0 && seatIndex < seats.length) {
                const seat = seats[seatIndex];
                const studentName = seatInfo.name;
                
                // 检查学生是否存在于班级名单中
                if (selectedClassData && selectedClassData.name.includes(studentName)) {
                    // 创建学生元素并添加到座位
                    const studentDiv = createStudentDiv(studentName);
                    seat.appendChild(studentDiv);
                    updateRowNumberVisibility(seat); // 更新行号显示
                    
                    // 更新学生列表中的状态
                    const studentInList = studentElementMap.get(studentName);
                    if (studentInList) {
                        studentInList.draggable = false;
                        studentInList.classList.add('disabled');
                    }
                }
            }
        });
        
        console.log('座位布局恢复完成');
    }
    
    /**
     * 恢复考勤数据到UI（不依赖localStorage）
     * @param {Object} attendanceData - 考勤数据
     */
    function restoreAttendanceToUI(attendanceData) {
        if (!attendanceData || !attendanceData.attendance) {
            console.log('没有考勤数据可恢复');
            return;
        }
        
        console.log('开始恢复考勤数据到UI...');
        
        // 更新日期选择器
        if (attendanceData.date) {
            dateToday.value = attendanceData.date;
        }
        
        // 清空所有考勤区域
        const attendanceCategories = attendanceArea.querySelectorAll('.attendance-category');
        attendanceCategories.forEach(category => {
            category.innerHTML = '';
        });
        
        // 恢复各类别的考勤学生
        Object.entries(attendanceData.attendance).forEach(([categoryName, students]) => {
            // 查找类别对应的索引
            const categoryTitles = document.querySelectorAll('.attendance-title h3');
            const categoryIndex = Array.from(categoryTitles).findIndex(
                h3 => h3.textContent.includes(categoryName)
            );
            
            if (categoryIndex !== -1 && categoryIndex < attendanceCategories.length) {
                const targetCategory = attendanceCategories[categoryIndex];
                const areaType = targetCategory.getAttribute('data-area-type');
                
                // 添加学生到考勤区域
                students.forEach(studentName => {
                    const studentDiv = createStudentDiv(studentName);
                    targetCategory.appendChild(studentDiv);
                    
                    // 如果是请假区域，需要特殊处理
                    if (areaType === "1") {
                        const studentInList = studentElementMap.get(studentName);
                        if (studentInList) {
                            studentInList.classList.add('disabled');
                            studentInList.draggable = false;
                        }
                    }
                });
            }
        });
        
        console.log('考勤数据恢复完成');
    }
    
    /**
     * 从剪贴板导入数据（支持多种格式）
     */
    function importDataFromClipboard() {
        const input = prompt('请粘贴座位布局与出勤记录代码：');
        
        if (!input || input.trim() === '') {
            return;
        }
        
        try {
            let importData;
            const trimmedInput = input.trim();
            
            // 检查数据格式并解析
            if (trimmedInput.startsWith('SEAT_TXT_v1:')) {
                console.log('检测到明文格式');
                const compactData = trimmedInput.substring(12);
                if (!compactData) {
                    throw new Error('明文数据为空');
                }
                importData = parseCompactTextFormat(compactData);
            } else if (trimmedInput.startsWith('SEAT_BIN_v1:')) {
                console.log('检测到二进制格式');
                const binaryData = trimmedInput.substring(12);
                if (!binaryData) {
                    throw new Error('二进制数据为空');
                }
                const minimalData = JSON.parse(atob(binaryData));
                importData = parseBinaryFormat(minimalData);
            } else if (trimmedInput.startsWith('SEAT_DATA_v1:')) {
                console.log('检测到旧版本格式');
                const encodedData = trimmedInput.substring(13);
                if (!encodedData) {
                    throw new Error('旧版本数据为空');
                }
                const jsonString = decodeURIComponent(atob(encodedData));
                importData = JSON.parse(jsonString);
            } else {
                throw new Error('无效的数据格式。支持的格式：SEAT_TXT_v1:, SEAT_BIN_v1:, SEAT_DATA_v1:');
            }
            
            if (!importData || !importData.className) {
                throw new Error('数据结构无效，缺少班级信息');
            }
            
            // 确认导入
            if (!confirm(`将导入班级 ${importData.className} 的数据，覆盖当前显示？`)) {
                return;
            }
            
            // 切换班级并恢复数据
            if (classMode.value !== importData.className) {
                classMode.value = importData.className;
                initClass();
            }
            
            // 恢复座位布局
            if (importData.currentSeatLayout && importData.currentSeatLayout.seats) {
                restoreSeatLayoutToUI(importData.currentSeatLayout);
            }
            
            // 恢复考勤数据
            if (importData.currentAttendance && importData.currentAttendance.attendance) {
                restoreAttendanceToUI(importData.currentAttendance);
            }
            
            alert('数据导入成功！');
            
        } catch (error) {
            console.error('导入数据失败:', error);
            alert(`导入失败：${error.message}\n\n请检查：\n1. 代码是否完整\n2. 格式是否正确\n3. 班级数据是否存在`);
        }
    }

    function parseBinaryFormat(minimalData) {
        const classData = classes.find(cls => cls.class === minimalData.c);
        if (!classData) throw new Error(`找不到班级 ${minimalData.c} 的数据`);
        
        const result = {
            className: minimalData.c,
            currentAttendance: { date: minimalData.d, attendance: {} },
            currentSeatLayout: { rows: minimalData.r, columns: minimalData.o, seats: [] }
        };
        
        // 解析座位数据
        if (minimalData.s) {
            minimalData.s.forEach(([row, col, nameIndex]) => {
                if (nameIndex >= 0 && nameIndex < classData.name.length) {
                    result.currentSeatLayout.seats.push({
                        name: classData.name[nameIndex], row, col
                    });
                }
            });
        }
        
        // 解析考勤数据
        if (minimalData.a) {
            Object.entries(minimalData.a).forEach(([catIndex, indices]) => {
                const categoryIndex = parseInt(catIndex);
                if (categoryIndex < attendanceCategories.length) {
                    const category = attendanceCategories[categoryIndex];
                    const students = indices
                        .filter(i => i >= 0 && i < classData.name.length)
                        .map(i => classData.name[i]);
                    if (students.length > 0) {
                        result.currentAttendance.attendance[category.category] = students;
                    }
                }
            });
        }
        
        return result;
    }
    
    /**
     * 显示导出代码弹窗（备用方案）
     * @param {string} exportCode - 导出代码
     */
    function showExportModal(exportCode) {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            padding: 20px;
            border-radius: 8px;
            max-width: 80%;
            max-height: 80%;
            overflow: auto;
        `;
        
        content.innerHTML = `
            <h3>座位布局与出勤记录代码</h3>
            <p>请复制以下代码并发送给其他人：</p>
            <textarea readonly style="width:100%;height:200px;margin:10px 0;">${exportCode}</textarea>
            <button onclick="this.parentElement.parentElement.remove()" style="padding:10px 20px;">关闭</button>
        `;
        
        modal.appendChild(content);
        document.body.appendChild(modal);
        
        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    /**
     * 载入保存的座位布局
     */
    function loadSeatLayout() {
        const selectedClass = classMode.value;
        if (!selectedClass) {
            alert('请先选择班级');
            return;
        }
        
        // 获取保存的座位数据
        const seatLayoutKey = `${selectedClass}_seatLayout`;
        const savedLayout = localStorage.getItem(seatLayoutKey);
        
        if (!savedLayout) {
            alert('没有找到保存的座位布局');
            return;
        }
        
        try {
            const layoutData = JSON.parse(savedLayout);
            
            // 如果保存的尺寸与当前不同，先调整尺寸
            if (layoutData.rows !== rows || layoutData.columns !== columns) {
                rows = layoutData.rows || rows;
                columns = layoutData.columns || columns;
                
                // 更新输入框的值
                rowInput.value = rows;
                colInput.value = columns;
                
                initSeatLayout();
            }
            
            // 清空现有座位上的学生
            const seatsWithStudents = seatLayout.querySelectorAll('.seat .student');
            seatsWithStudents.forEach(student => student.remove());
            
            // 恢复所有学生状态
            const selectedClassData = classes.find(cls => cls.class === selectedClass);
            if (selectedClassData) {
                selectedClassData.name.forEach(studentName => {
                    const studentInList = studentElementMap.get(studentName);
                    if (studentInList) {
                        studentInList.classList.remove('disabled');
                        studentInList.draggable = true;
                    }
                });
            }
            
            // 填充座位
            const seats = seatLayout.querySelectorAll('.seat');
            layoutData.seats.forEach(seatInfo => {
                // 计算座位索引
                const seatIndex = (rows - seatInfo.row) * columns + (seatInfo.col - 1);
                
                if (seatIndex >= 0 && seatIndex < seats.length) {
                    const seat = seats[seatIndex];
                    const studentName = seatInfo.name;
                    
                    // 检查学生是否存在于班级名单中
                    if (selectedClassData && selectedClassData.name.includes(studentName)) {
                        // 创建学生元素并添加到座位
                        const studentDiv = createStudentDiv(studentName);
                        seat.appendChild(studentDiv);
                        
                        // 更新学生列表中的状态
                        const studentInList = studentElementMap.get(studentName);
                        if (studentInList) {
                            studentInList.draggable = false;
                            studentInList.classList.add('disabled');
                        }
                    }
                }
            });
            
            alert('成功加载座位布局');
            
        } catch (error) {
            console.error('加载座位布局失败:', error);
            alert('加载座位布局失败');
        }
    }

    // ========================
    // 6. 工具函数 / Utility Functions
    // ========================
    
    /**
     * 创建学生div元素
     * @param {string} studentName - 学生姓名
     * @returns {HTMLElement} - 创建的学生div元素
     */
    function createStudentDiv(studentName) {
        const selectedClassData = classes.find(cls => cls.class === classMode.value);
        const index = selectedClassData ? selectedClassData.name.findIndex(student => student === studentName) : -1;
        
        const div = document.createElement("div");
        div.className = "student";
        div.title = index !== -1 ? (index + 1) : "?";                      // 设置title为学生序号，如果找不到则显示"?"
        div.textContent = studentName;              // 设置内容为学生姓名
        div.draggable = true;                       // 允许拖动
        return div;
    }

    /**
     * 获取特定考勤类别中的学生列表
     * @param {string} category - 考勤类别名称
     * @returns {Array} - 该类别中的学生姓名数组
     */
    function getAttendanceStudents(category) {
        // 查找类别对应的索引
        const categoryTitles = document.querySelectorAll('.attendance-title h3');
        const categoryIndex = Array.from(categoryTitles).findIndex(
            h3 => h3.textContent.includes(category)
        );
        if (categoryIndex === -1) return [];
        
        // 返回该类别下所有学生的姓名
        return Array.from(attendanceArea.children[categoryIndex].children)
            .map(div => div.textContent);
    }

    /**
     * 点击事件处理：切换学生元素的绿色标记
     * @param {MouseEvent} event - 点击事件对象
     */
    function toggleSeatColor(event) {
        // 确保点击的是学生元素
        if (event.target.classList.contains('student')) {
            const studentElement = event.target;
            studentElement.classList.toggle('green'); // 切换绿色标记
        }
    }

    /**
     * 将标记为绿色的学生添加到对应的考勤类别
     * @param {MouseEvent} event - 点击事件对象
     */
    function addGreenStudentsToAttendance(event) {
        const category = event.target.textContent;  // 获取点击的考勤类别
        const greenStudents = document.querySelectorAll('.student.green'); // 获取所有标记为绿色的学生
        
        // 查找类别对应的索引
        const categoryTitles = document.querySelectorAll('.attendance-title h3');
        const categoryIndex = Array.from(categoryTitles).findIndex(
            h3 => h3.textContent.includes(category)
        );
        if (categoryIndex === -1) return;
        
        // 获取目标考勤类别容器和区域类型
        const targetCategory = attendanceArea.children[categoryIndex];
        const areaType = targetCategory.getAttribute('data-area-type');
        
        // 处理每个绿色标记的学生
        greenStudents.forEach(student => {
            const studentName = student.textContent;
            const div = createStudentDiv(studentName);
            targetCategory.appendChild(div);        // 添加到目标考勤类别
            
            // 如果是请假区域，需要特殊处理
            if (areaType === "1") {
                // 更新学生列表中的状态
                const studentInList = studentElementMap.get(studentName);
                if (studentInList) {
                    studentInList.classList.add('disabled');   // 添加禁用样式
                    studentInList.draggable = false;           // 禁止拖动
                }
                
                // 如果学生是从座位区标绿并移到请假区，需要从座位移除
                if (student.parentElement.classList.contains('seat')) {
                    student.remove();               // 从座位移除
                } else {
                    student.classList.remove('green'); // 否则仅移除绿色标记
                }
            } else {
                student.classList.remove('green');  // 移除绿色标记
            }
        });
    }
    
    // ========================
    // 7. 事件绑定 / Event Binding
    // ========================
    
    /**
     * 绑定所有事件监听器
     */
    function bindEvents() {
        // 基本UI事件
        classMode.addEventListener("change", initClass);       // 班级切换
        rollCallBtn.addEventListener("click", handleRollCall); // 点名按钮
        document.getElementById('saveBtn').addEventListener('click', saveAttendance);     // 保存考勤
        document.getElementById('loadSeatBtn').addEventListener('click', loadSeatLayout); // 载入座位布局
        document.getElementById('importSeatBtn').addEventListener('click', importDataFromClipboard); // 导入座位数据
        createLayoutBtn.addEventListener('click', createCustomLayout); // 创建自定义布局
        document.getElementById('trashBin').addEventListener('click', () => { 
            clearAttendanceArea(attendanceArea);               // 清空考勤区
        });
        
        // 拖放相关事件
        const container = document.querySelector("#container");
        container.addEventListener("dragover", dragOver);      // 允许拖动经过
        container.addEventListener("drop", drop);              // 处理放置
        
        // --- 使用事件委托 ---
        // 为各区域添加拖动开始事件
        studentList.addEventListener("dragstart", dragStart);  // 学生列表
        seatLayout.addEventListener("dragstart", dragStart);   // 座位布局
        attendanceArea.addEventListener("dragstart", dragStart); // 考勤区域
        
        // 点击事件（用于标记绿色）
        seatLayout.addEventListener("click", toggleSeatColor); // 座位区点击
        studentList.addEventListener("click", toggleSeatColor); // 学生列表点击
        
        // 考勤分类标题点击事件（使用事件委托）
        const categoryTitlesContainer = document.querySelector('.attendance-title');
        categoryTitlesContainer.addEventListener('click', (event) => {
            if (event.target.tagName === 'H3') {
                addGreenStudentsToAttendance(event);           // 处理绿色标记学生
            }
        });
        // --- 委托结束 ---
    }

    // ========================
    // 8. 主应用初始化 / Main App Initialization
    // ========================
    
    /**
     * 初始化应用
     */
    function init() {
        initDate();                                 // 初始化日期
        initClassSelection();                       // 初始化班级选择
        
        // 加载保存的布局配置
        loadLayoutConfig();
        
        initSeatLayout();                           // 初始化座位布局
        initAttendanceArea();                       // 初始化考勤区域
        bindEvents();                               // 绑定事件
    }

    // 返回公共API
    return {
        init                                        // 暴露初始化方法
    };
})();

// 初始化应用 / Initialize application
app.init();