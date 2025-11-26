/**
 * 学生表现管理系统 - 主应用逻辑 (模块化重构版)
 * 整合了配置、数据管理、UI渲染和事件处理逻辑。
 */
const app = (() => {

    // ========================
    // 1. 配置 (Config) - 集中管理常量
    // ========================
    const Config = {
        // 考勤类别定义：category-类别名称, score-分数权重, areaType-区域类型(0-普通, 1-请假)
        ATTENDANCE_CATEGORIES: [
            { category: '加', score: -1, areaType: 0 },
            { category: '迟', score: 1, areaType: 0 },
            { category: '假', score: 1, areaType: 1 },  // 请假(特殊区域)
            { category: '旷', score: 5, areaType: 0 },
            { category: '睡', score: 2, areaType: 0 },
            { category: '玩', score: 2, areaType: 0 }
        ],
        // 默认座位布局配置
        DEFAULT_LAYOUT: {
            rows: 11,
            columns: 12,
            aisleColumns: []
        },
        // LocalStorage Key 常量
        LS_KEYS: {
            CLASSES: 'classes',
            CURRENT_LAYOUT_CONFIG: 'currentLayoutConfig',
            ATTENDANCE_CATEGORIES: 'attendanceCategories'
        }
    };

    // ========================
    // 2. 状态与 DOM 引用 (State & DOM References)
    // ========================
    let classes = JSON.parse(localStorage.getItem(Config.LS_KEYS.CLASSES)) || [];

    // 布局状态变量
    let rows = Config.DEFAULT_LAYOUT.rows;
    let columns = Config.DEFAULT_LAYOUT.columns;
    let aisleColumns = Config.DEFAULT_LAYOUT.aisleColumns;
    let studentElementMap = new Map();              // 学生姓名到DOM元素的映射
    let draggedStudent;                             // 拖放状态变量

    // DOM元素引用
    const classMode = document.getElementById("classMode");
    const studentList = document.getElementById("studentList");
    const rollCallBtn = document.getElementById("rollCallBtn");
    const rollCallResult = document.getElementById("rollCallResult");
    const seatLayout = document.getElementById("seatLayout");
    const attendanceArea = document.getElementById("attendanceArea");
    const dateToday = document.getElementById("dateToday");
    const rowInput = document.getElementById("rowInput");
    const colInput = document.getElementById("colInput");
    const aisleInput = document.getElementById("aisleInput");
    const createLayoutBtn = document.getElementById("createLayoutBtn");
    const trashBin = document.getElementById('trashBin');
    const saveBtn = document.getElementById('saveBtn');
    const loadAttendanceBtn = document.getElementById('loadAttendanceBtn');
    const loadSeatBtn = document.getElementById('loadSeatBtn');
    const importSeatBtn = document.getElementById('importSeatBtn');

    // 弹窗引用
    const rollCallModal = document.getElementById('rollCallModal');
    const closeRollCallModal = document.getElementById('closeRollCallModal');
    const rollCallModalResult = document.getElementById('rollCallModalResult');

    // ========================
    // 3. 辅助工具函数 (Utility Functions)
    // ========================

    /**
     * 创建学生div元素
     */
    function createStudentDiv(studentName) {
        const selectedClassData = classes.find(cls => cls.class === classMode.value);
        const index = selectedClassData ? selectedClassData.name.findIndex(student => student === studentName) : -1;

        const div = document.createElement("div");
        div.className = "student";
        div.title = index !== -1 ? (index + 1) : "?";
        div.textContent = studentName;
        div.draggable = true;
        return div;
    }

    /**
     * 更新座位的行号显示状态
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
     */
    function parseAisleConfiguration(aisleInputStr, totalColumns) {
        if (!aisleInputStr || !aisleInputStr.trim()) {
            return [];
        }

        const aisles = aisleInputStr.split(',').map(s => {
            const num = parseInt(s.trim());
            return isNaN(num) ? null : num;
        }).filter(num => num !== null && num >= 1 && num <= totalColumns);

        return [...new Set(aisles)]; // 去重
    }

    // ========================
    // 4. 数据管理 (DataManager) - 封装数据持久化和计算逻辑
    // ========================
    const DataManager = (() => {

        /**
         * 加载当前布局配置（同时更新全局变量）
         */
        function loadLayoutConfig() {
            const savedConfig = localStorage.getItem(Config.LS_KEYS.CURRENT_LAYOUT_CONFIG);
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

                        return true;
                    }
                } catch (error) {
                    console.error('加载布局配置失败:', error);
                }
            }
            // 使用默认值更新输入框
            rowInput.value = rows;
            colInput.value = columns;
            aisleInput.value = aisleColumns.join(', ');
            return false;
        }

        /**
         * 保存当前布局配置
         */
        function saveLayoutConfig() {
            const layoutConfig = {
                rows: rows,
                columns: columns,
                aisleColumns: aisleColumns
            };
            localStorage.setItem(Config.LS_KEYS.CURRENT_LAYOUT_CONFIG, JSON.stringify(layoutConfig));
        }

        /**
         * 获取特定考勤类别中的学生列表
         */
        function getAttendanceStudents(category) {
            const categoryTitles = document.querySelectorAll('.attendance-title .category-title');
            const categoryIndex = Array.from(categoryTitles).findIndex(
                h3 => h3.textContent.includes(category)
            );
            if (categoryIndex === -1) return [];

            return Array.from(attendanceArea.children[categoryIndex].children)
                .map(div => div.textContent);
        }

        /**
         * 获取当前座位布局数据（从UI中实时获取）
         */
        function getCurrentSeatLayout() {
            const selectedClass = classMode.value;
            if (!selectedClass) return null;

            const seats = seatLayout.querySelectorAll('.seat');
            const seatData = [];

            seats.forEach((seat) => {
                const student = seat.querySelector('.student');

                if (student) {
                    const allGridItems = seatLayout.children; // 包含过道
                    const seatIndexInGrid = Array.from(allGridItems).indexOf(seat);

                    const totalColsWithAisles = columns + aisleColumns.length;
                    const row = rows - Math.floor(seatIndexInGrid / totalColsWithAisles);
                    const col = (seatIndexInGrid % totalColsWithAisles) + 1;

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
         */
        function getCurrentAttendanceData() {
            const selectedClass = classMode.value;
            if (!selectedClass) return null;

            const currentDate = dateToday.value;

            const attendanceData = {
                date: currentDate,
                attendance: {}
            };

            Config.ATTENDANCE_CATEGORIES.forEach(item => {
                attendanceData.attendance[item.category] = getAttendanceStudents(item.category);
            });

            return attendanceData;
        }

        // --- 导出/导入逻辑 (保持不变以确保兼容性) ---

        function createCompactExportFormat(className, seatLayout, attendanceData) {
            const parts = [];
            const date = attendanceData ? attendanceData.date : new Date().toISOString().split('T')[0];
            const layoutInfo = seatLayout ? `${seatLayout.rows}x${seatLayout.columns}` : `${rows}x${columns}`;
            parts.push(`${className}|${date}|${layoutInfo}`);

            // 座位布局
            if (seatLayout && seatLayout.seats && seatLayout.seats.length > 0) {
                const classData = classes.find(cls => cls.class === className);
                const nameMap = new Map();
                if (classData) { classData.name.forEach((name, index) => nameMap.set(name, index)); }

                const seatEntries = seatLayout.seats
                    .map(seat => `${seat.row},${seat.col}:${nameMap.get(seat.name) ?? '?'}`)
                    .join(';');
                parts.push(`S:${seatEntries}`);
            } else { parts.push('S:'); }

            // 考勤数据
            if (attendanceData && attendanceData.attendance) {
                const classData = classes.find(cls => cls.class === className);
                const nameMap = new Map();
                if (classData) { classData.name.forEach((name, index) => nameMap.set(name, index)); }

                const attendanceEntries = [];
                Config.ATTENDANCE_CATEGORIES.forEach(category => {
                    const categoryStudents = attendanceData.attendance[category.category] || [];
                    if (categoryStudents.length > 0) {
                        const indices = categoryStudents
                            .map(name => nameMap.get(name) ?? '?')
                            .filter(idx => idx !== '?')
                            .join(',');
                        if (indices) { attendanceEntries.push(`${category.category}:${indices}`); }
                    }
                });
                parts.push(`A:${attendanceEntries.join(';')}`);
            } else { parts.push('A:'); }

            return parts.join('|');
        }

        function createBinaryExportFormat(className, seatLayout, attendanceData) {
            const minimalData = {
                c: className,
                d: attendanceData ? attendanceData.date : new Date().toISOString().split('T')[0],
                r: seatLayout ? seatLayout.rows : rows,
                o: seatLayout ? seatLayout.columns : columns
            };

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

            if (attendanceData && attendanceData.attendance) {
                const classData = classes.find(cls => cls.class === className);
                if (classData) {
                    const nameMap = new Map();
                    classData.name.forEach((name, index) => nameMap.set(name, index));

                    minimalData.a = {};
                    Config.ATTENDANCE_CATEGORIES.forEach((category, catIndex) => {
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

            const jsonString = JSON.stringify(minimalData);
            return btoa(jsonString);
        }

        function parseCompactTextFormat(compactData) {
            // ... (解析逻辑保持不变，依赖全局 classes)
            const parts = compactData.split('|');
            if (parts.length < 3) {
                throw new Error('明文数据格式错误，数据不完整');
            }

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

        function parseBinaryFormat(minimalData) {
            const classData = classes.find(cls => cls.class === minimalData.c);
            if (!classData) throw new Error(`找不到班级 ${minimalData.c} 的数据`);

            const result = {
                className: minimalData.c,
                currentAttendance: { date: minimalData.d, attendance: {} },
                currentSeatLayout: { rows: minimalData.r, columns: minimalData.o, seats: [] }
            };

            if (minimalData.s) {
                minimalData.s.forEach(([row, col, nameIndex]) => {
                    if (nameIndex >= 0 && nameIndex < classData.name.length) {
                        result.currentSeatLayout.seats.push({
                            name: classData.name[nameIndex], row, col
                        });
                    }
                });
            }

            if (minimalData.a) {
                Object.entries(minimalData.a).forEach(([catIndex, indices]) => {
                    const categoryIndex = parseInt(catIndex);
                    if (categoryIndex < Config.ATTENDANCE_CATEGORIES.length) {
                        const category = Config.ATTENDANCE_CATEGORIES[categoryIndex];
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

        return {
            loadLayoutConfig,
            saveLayoutConfig,
            getCurrentSeatLayout,
            getCurrentAttendanceData,
            createCompactExportFormat,
            createBinaryExportFormat,
            parseCompactTextFormat,
            parseBinaryFormat,
            getAttendanceStudents
        };
    })();

    // ========================
    // 5. UI 渲染与初始化 (UIRenderer)
    // ========================
    const UIRenderer = (() => {

        /**
         * 初始化日期选择器为当天日期
         */
        function initDate() {
            dateToday.value = new Date().toISOString().split('T')[0];
        }

        /**
         * 初始化班级选择下拉菜单
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
         */
        function initStudentList(students) {
            studentList.innerHTML = "";
            studentElementMap.clear();

            students.forEach(student => {
                const studentDiv = createStudentDiv(student);
                studentDiv.draggable = true;
                studentDiv.classList.remove('disabled');
                studentList.appendChild(studentDiv);
                studentElementMap.set(student, studentDiv);
            });
        }

        /**
         * 初始化考勤区域
         */
        function initAttendanceArea() {
            const attendanceTitle = document.querySelector('.attendance-title');
            attendanceTitle.innerHTML = '';
            attendanceArea.innerHTML = '';

            Config.ATTENDANCE_CATEGORIES.forEach(item => {
                const h3 = document.createElement('h3');
                h3.className = 'category-title';
                h3.textContent = item.category;
                attendanceTitle.appendChild(h3);

                const div = document.createElement('div');
                div.className = 'attendance-category';
                div.setAttribute('data-area-type', item.areaType);
                attendanceArea.appendChild(div);
            });
        }

        /**
         * 清空考勤区域中的所有学生
         */
        function clearAttendanceArea(area) {
            const studentsInCategory = area.querySelectorAll(".student");

            studentsInCategory.forEach(studentInCategory => {
                const parent = studentInCategory.parentElement;
                const areaType = parent.getAttribute('data-area-type');
                const studentName = studentInCategory.textContent;

                if (areaType === '1') {
                    const studentInList = studentElementMap.get(studentName);
                    if (studentInList) {
                        studentInList.classList.remove('disabled');
                        studentInList.draggable = true;
                    }
                }
                studentInCategory.remove();
            });
        }

        /**
         * 初始化座位布局
         */
        function initSeatLayout() {
            seatLayout.innerHTML = "";

            const actualColumns = columns + aisleColumns.length;
            seatLayout.style.gridTemplateColumns = `repeat(${actualColumns}, 1fr)`;

            let gridColCounter = 1;
            let logicalColCounter = 1;

            for (let row = 1; row <= rows; row++) {
                gridColCounter = 1;
                logicalColCounter = 1;

                for (let col = 1; col <= columns; col++) {
                    // 检查在当前逻辑列之前是否需要插入过道
                    if (aisleColumns.includes(col)) {
                        const aisle = document.createElement("div");
                        aisle.className = "aisle";
                        seatLayout.appendChild(aisle);
                        gridColCounter++;
                    }

                    const seat = document.createElement("div");
                    seat.className = "seat";
                    seat.textContent = "";

                    const currentRow = rows - row + 1;

                    const rowNumberLabel = document.createElement('span');
                    rowNumberLabel.className = 'row-number';
                    rowNumberLabel.textContent = currentRow;
                    seat.appendChild(rowNumberLabel);

                    // 设置特殊座位样式
                    if ((columns === 8 && col <= 4) ||
                        (columns === 10 && (col <= 2 || col > columns - 2)) ||
                        (columns !== 8 && columns !== 10 && col <= Math.floor(columns / 2))) {
                        seat.classList.add('special-seat');
                    }

                    // 添加逻辑位置信息，便于数据恢复
                    seat.setAttribute('data-l-row', currentRow);
                    seat.setAttribute('data-l-col', logicalColCounter);

                    seatLayout.appendChild(seat);
                    gridColCounter++;
                    logicalColCounter++;
                }
            }

            clearAttendanceArea(attendanceArea);
        }

        /**
         * 初始化班级，加载学生列表和座位布局
         */
        function initClass() {
            const selectedClass = classes.find(cls => cls.class === classMode.value);
            if (selectedClass) {
                initStudentList(selectedClass.name);
            } else {
                initStudentList([]);
            }
            initSeatLayout();
            initDate();
            // rollCallResult.textContent = ""; // 已移除
        }

        /**
         * 恢复座位布局到UI
         */
        function restoreSeatLayoutToUI(seatLayoutData) {
            if (!seatLayoutData || !seatLayoutData.seats) return;

            // 调整尺寸并重新初始化座位布局
            if (seatLayoutData.rows !== rows || seatLayoutData.columns !== columns) {
                rows = seatLayoutData.rows || rows;
                columns = seatLayoutData.columns || columns;

                rowInput.value = rows;
                colInput.value = columns;

                initSeatLayout();
            } else {
                // 清空现有座位上的学生
                seatLayout.querySelectorAll('.seat .student').forEach(student => student.remove());
            }

            // 恢复所有学生状态（重要：恢复列表可拖动状态）
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
            seatLayoutData.seats.forEach(seatInfo => {
                const seat = seatLayout.querySelector(`[data-l-row="${seatInfo.row}"][data-l-col="${seatInfo.col}"]`);
                const studentName = seatInfo.name;

                if (seat && selectedClassData && selectedClassData.name.includes(studentName)) {
                    const studentDiv = createStudentDiv(studentName);
                    seat.appendChild(studentDiv);
                    updateRowNumberVisibility(seat);

                    const studentInList = studentElementMap.get(studentName);
                    if (studentInList) {
                        studentInList.draggable = false;
                        studentInList.classList.add('disabled');
                    }
                }
            });
        }

        /**
         * 恢复考勤数据到UI
         */
        function restoreAttendanceToUI(attendanceData) {
            if (!attendanceData || !attendanceData.attendance) return;

            if (attendanceData.date) {
                dateToday.value = attendanceData.date;
            }

            // 清空所有考勤区域
            attendanceArea.querySelectorAll('.attendance-category').forEach(category => {
                category.innerHTML = '';
            });

            // 恢复各类别的考勤学生
            Object.entries(attendanceData.attendance).forEach(([categoryName, students]) => {
                const categoryTitles = document.querySelectorAll('.attendance-title .category-title');
                const categoryIndex = Array.from(categoryTitles).findIndex(
                    h3 => h3.textContent.includes(categoryName)
                );

                if (categoryIndex !== -1 && categoryIndex < attendanceArea.children.length) {
                    const targetCategory = attendanceArea.children[categoryIndex];
                    const areaType = targetCategory.getAttribute('data-area-type');

                    students.forEach(studentName => {
                        const studentDiv = createStudentDiv(studentName);
                        targetCategory.appendChild(studentDiv);

                        if (areaType === "1") { // 请假区域
                            const studentInList = studentElementMap.get(studentName);
                            if (studentInList) {
                                studentInList.classList.add('disabled');
                                studentInList.draggable = false;
                            }
                        }
                    });
                }
            });
        }

        /**
         * 显示导出代码弹窗
         */
        function showExportModal(exportCode) {
            // (函数逻辑保持不变，创建并显示一个临时的模态框)
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.5); display: flex; justify-content: center;
                align-items: center; z-index: 10000;
            `;

            const content = document.createElement('div');
            content.style.cssText = `
                background: white; padding: 20px; border-radius: 8px;
                max-width: 80%; max-height: 80%; overflow: auto;
            `;

            content.innerHTML = `
                <h3>座位布局与出勤记录代码</h3>
                <p>请复制以下代码并发送给其他人：</p>
                <textarea readonly style="width:100%;height:200px;margin:10px 0;">${exportCode}</textarea>
                <button onclick="this.parentElement.parentElement.remove()" style="padding:10px 20px;">关闭</button>
            `;

            modal.appendChild(content);
            document.body.appendChild(modal);

            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });
        }

        return {
            initDate,
            initClassSelection,
            initAttendanceArea,
            initClass,
            initSeatLayout,
            updateRowNumberVisibility,
            clearAttendanceArea,
            restoreSeatLayoutToUI,
            restoreAttendanceToUI,
            showExportModal
        };
    })();


    // ========================
    // 6. 事件处理器 (EventHandler)
    // ========================
    const EventHandler = (() => {

        // --- 拖放事件 ---

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

                const sourceParent = draggedStudent.parentElement;

                // 拖动到座位区域
                if (target.classList.contains('seat') && !target.classList.contains('aisle') && !sourceParent.classList.contains("attendance-category")) {
                    if (sourceParent.id === 'studentList') {
                        const div = createStudentDiv(studentName);
                        target.appendChild(div);
                        UIRenderer.updateRowNumberVisibility(target);

                        const studentInList = studentElementMap.get(studentName);
                        if (studentInList) {
                            studentInList.draggable = false;
                            studentInList.classList.add('disabled');
                        }
                    } else {
                        target.appendChild(draggedStudent);
                        UIRenderer.updateRowNumberVisibility(target);
                        UIRenderer.updateRowNumberVisibility(sourceParent);
                    }
                }
                // 座位上已有学生，交换位置
                else if (target.parentElement.classList.contains("seat") && sourceParent.classList.contains("seat")) {
                    const existingStudentName = target.textContent;
                    const existingStudentDiv = createStudentDiv(existingStudentName);

                    sourceParent.appendChild(existingStudentDiv);
                    target.parentElement.appendChild(draggedStudent);
                    target.remove();

                    UIRenderer.updateRowNumberVisibility(sourceParent);
                    UIRenderer.updateRowNumberVisibility(target.parentElement);
                }
                // 拖动到考勤区域
                else if (target.parentElement.id === "attendanceArea") {
                    const targetCategory = target;
                    const areaType = targetCategory.getAttribute('data-area-type');

                    const studentInSeat = sourceParent.classList.contains("seat");
                    const studentInAttendance = sourceParent.parentElement.id === "attendanceArea";
                    const studentInList = sourceParent.id === 'studentList';
                    const sourceAreaType = studentInAttendance ? sourceParent.getAttribute('data-area-type') : null;

                    // 1. 唯一性检查 (仅应用于 areaType: 1)
                    if (areaType === "1") {
                        const existingStudents = Array.from(targetCategory.children).map(el => el.textContent);
                        if (existingStudents.includes(studentName)) {
                            return;
                        }
                    }

                    // A. 如果目标是 '请假' 区 (areaType === "1")
                    if (areaType === "1") {

                        // 1. 禁用列表元素
                        const studentInListElement = studentElementMap.get(studentName);
                        if (studentInListElement) {
                            studentInListElement.classList.add('disabled');
                            studentInListElement.draggable = false;
                        }

                        // 2. 移除座位中的学生 (统一处理：无论拖拽来源是什么，只要目标是请假区，就要离开座位)
                        const allSeatStudents = Array.from(seatLayout.querySelectorAll('.seat .student'));
                        const seatStudent = allSeatStudents.find(el => el.textContent === studentName);

                        if (seatStudent) {
                            const seatParent = seatStudent.parentElement;
                            seatStudent.remove();
                            UIRenderer.updateRowNumberVisibility(seatParent);
                        }

                        // 3. 移除拖拽源元素 (如果不是来自列表，因为列表是复制)
                        if (!studentInList) {
                            draggedStudent.remove();
                        }

                    }
                    // B. 如果目标是非 '请假' 区 (areaType === "0")
                    else {

                        // 1. 处理从 '假' 区移走，恢复列表状态
                        if (studentInAttendance && sourceAreaType === '1') {
                            const studentInListElement = studentElementMap.get(studentName);
                            if (studentInListElement) {
                                studentInListElement.draggable = true;
                                studentInListElement.classList.remove('disabled');
                            }
                        }

                        // 2. 移除拖拽源元素 (仅在以下情况移除：来自其他考勤区且目标不同，或来自座位且源不是列表)
                        // **重要修正：来自座位 (studentInSeat) 时，不应移除自身。应保留座位上的学生。**
                        if (studentInAttendance && sourceParent !== targetCategory) {
                            draggedStudent.remove();
                        }

                    }

                    // 4. 插入新学生元素 (统一处理：从列表/座位/其他考勤区拖入都需要一个新的副本)
                    // 检查是否需要插入新副本：
                    // - 来自列表 (总是复制)
                    // - 来自座位 (总是复制)
                    // - 来自考勤区且目标是请假区 (总是复制)
                    // - 来自考勤区且目标是非请假区且源目标不同 (总是复制)
                    // - 来自考勤区且目标是非请假区且源目标相同 (复制，实现重复扣分)

                    if (studentInList || studentInSeat || studentInAttendance) {
                        const newDiv = createStudentDiv(studentName);
                        targetCategory.appendChild(newDiv);
                    }
                }
                // 拖动到垃圾桶（删除/恢复）
                else if (target.id === 'trashBin' || target.parentElement.id === 'trashBin') {

                    const wasSeat = sourceParent.classList.contains("seat");

                    if (wasSeat || sourceParent.getAttribute('data-area-type') === "1") {
                        // 恢复学生列表状态
                        const studentInList = studentElementMap.get(studentName);
                        if (studentInList) {
                            studentInList.draggable = true;
                            studentInList.classList.remove('disabled');
                        }
                    }

                    if (sourceParent.id !== 'studentList') {
                        draggedStudent.remove();
                    }

                    if (wasSeat) {
                        UIRenderer.updateRowNumberVisibility(sourceParent);
                    }
                }
                // 拖回学生列表区域
                else if (target.id === 'studentList' || target.parentElement.id === 'studentList') {

                    const wasSeat = sourceParent.classList.contains("seat");

                    if (wasSeat || sourceParent.parentElement.id === 'attendanceArea') {
                        // 恢复学生列表状态
                        const studentInList = studentElementMap.get(studentName);
                        if (studentInList) {
                            studentInList.draggable = true;
                            studentInList.classList.remove('disabled');
                        }
                    }

                    if (sourceParent.id !== 'studentList') {
                        draggedStudent.remove();
                    }

                    if (wasSeat) {
                        UIRenderer.updateRowNumberVisibility(sourceParent);
                    }
                }
            } catch (error) {
                console.error("拖拽事件处理失败:", error);
                draggedStudent = null;
            }
        }

        // --- UI 交互 ---

        function toggleSeatColor(event) {
            if (event.target.classList.contains('student')) {
                event.target.classList.toggle('green');
            }
        }

        function addGreenStudentsToAttendance(event) {
            const category = event.target.textContent;
            const greenStudents = document.querySelectorAll('.student.green');

            const categoryTitles = document.querySelectorAll('.attendance-title h3');
            const categoryIndex = Array.from(categoryTitles).findIndex(
                h3 => h3.textContent.includes(category)
            );
            if (categoryIndex === -1) return;

            const targetCategory = attendanceArea.children[categoryIndex];
            const areaType = targetCategory.getAttribute('data-area-type');

            greenStudents.forEach(student => {
                const studentName = student.textContent;

                // --- 唯一性检查 (仅应用于 areaType: 1) ---
                if (areaType === "1") {
                    const exists = Array.from(targetCategory.children).some(el => el.textContent === studentName);
                    if (exists) {
                        student.classList.remove('green');
                        return; // 学生已在请假区，跳过
                    }
                }
                // --- 唯一性检查结束 ---

                // --- 目标是 '请假'，移除座位上的学生 ---
                if (areaType === "1") {
                    const allSeatStudents = Array.from(seatLayout.querySelectorAll('.seat .student'));
                    const seatStudent = allSeatStudents.find(el => el.textContent === studentName);

                    if (seatStudent) {
                        const seatParent = seatStudent.parentElement;
                        seatStudent.remove();
                        UIRenderer.updateRowNumberVisibility(seatParent);
                    }
                }
                // --- 目标是 '请假'，禁用列表元素 ---
                if (areaType === "1") { // 请假区域
                    const studentInList = studentElementMap.get(studentName);
                    if (studentInList) {
                        studentInList.classList.add('disabled');
                        studentInList.draggable = false;
                    }
                }

                // 统一添加新元素
                const div = createStudentDiv(studentName);
                targetCategory.appendChild(div);

                // 移除绿色标记
                student.classList.remove('green');
            });
        }

        // --- 功能事件 ---

        function handleRollCall() {
            const selectedClass = classMode.value;
            if (!selectedClass) {
                rollCallModalResult.textContent = "请先选择班级";
                rollCallModal.style.display = "block";
                return;
            }

            const classData = classes.find(cls => cls.class === selectedClass);
            if (!classData || classData.name.length === 0) {
                rollCallModalResult.textContent = "没有学生可点名";
                rollCallModal.style.display = "block";
                return;
            }

            // 获取当前请假学生名单，点名时排除
            const leaveStudents = DataManager.getAttendanceStudents('假');
            const availableStudents = classData.name.filter(name => !leaveStudents.includes(name));

            if (availableStudents.length === 0) {
                rollCallModalResult.textContent = "所有学生均已请假或缺勤";
                rollCallModal.style.display = "block";
                return;
            }

            const randomIndex = Math.floor(Math.random() * availableStudents.length);
            const selectedStudent = availableStudents[randomIndex];
            rollCallModalResult.textContent = selectedStudent;

            const addBonusBtn = document.getElementById('addBonusBtn');
            addBonusBtn.style.display = 'inline-block';

            // 移除旧的事件监听器（如果有的话），避免重复绑定
            const newBtn = addBonusBtn.cloneNode(true);
            addBonusBtn.parentNode.replaceChild(newBtn, addBonusBtn);

            newBtn.addEventListener('click', () => {
                const category = '加'; // 对应 Config.ATTENDANCE_CATEGORIES 中的 '加'
                const categoryTitles = document.querySelectorAll('.attendance-title h3');
                const categoryIndex = Array.from(categoryTitles).findIndex(
                    h3 => h3.textContent.includes(category)
                );

                if (categoryIndex !== -1) {
                    const targetCategory = attendanceArea.children[categoryIndex];
                    const div = createStudentDiv(selectedStudent);
                    targetCategory.appendChild(div);
                    rollCallModal.style.display = "none"; // 点击后关闭弹窗
                }
            });

            rollCallModal.style.display = "block";
        }

        function saveAttendance() {
            const selectedClass = classMode.value;
            if (!selectedClass) {
                alert('请先选择班级');
                return;
            }

            const currentDate = dateToday.value;
            const attendanceData = DataManager.getCurrentAttendanceData();

            // 获取班级历史考勤记录
            const classRecords = JSON.parse(localStorage.getItem(selectedClass)) || [];
            const existingRecordIndex = classRecords.findIndex(record => record.date === currentDate);

            // 更新或添加考勤记录
            if (existingRecordIndex !== -1) {
                classRecords[existingRecordIndex] = attendanceData;
            } else {
                classRecords.push(attendanceData);
            }

            localStorage.setItem(selectedClass, JSON.stringify(classRecords));
            localStorage.setItem(Config.LS_KEYS.CLASSES, JSON.stringify(classes));
            localStorage.setItem(Config.LS_KEYS.ATTENDANCE_CATEGORIES, JSON.stringify(Config.ATTENDANCE_CATEGORIES));

            // 同时保存当前座位布局
            const seatLayoutData = DataManager.getCurrentSeatLayout();
            if (seatLayoutData) {
                const seatLayoutKey = `${selectedClass}_seatLayout`;
                localStorage.setItem(seatLayoutKey, JSON.stringify(seatLayoutData));
            }

            // 导出数据到剪贴板
            exportDataToClipboard(selectedClass);

            alert('出勤记录和座位布局已保存，数据已复制到剪贴板！');
        }

        function exportDataToClipboard(selectedClass) {
            try {
                const currentSeatLayout = DataManager.getCurrentSeatLayout();
                const currentAttendanceData = DataManager.getCurrentAttendanceData();

                const compactData = DataManager.createCompactExportFormat(selectedClass, currentSeatLayout, currentAttendanceData);
                const plainTextLength = compactData.length;

                let exportCode;
                if (plainTextLength <= 2800) {
                    exportCode = `SEAT_TXT_v1:${compactData}`;
                } else {
                    const binaryData = DataManager.createBinaryExportFormat(selectedClass, currentSeatLayout, currentAttendanceData);
                    exportCode = `SEAT_BIN_v1:${binaryData}`;
                }

                navigator.clipboard.writeText(exportCode).then(() => {
                    console.log('数据已复制到剪贴板');
                }).catch(err => {
                    console.error('复制失败:', err);
                    UIRenderer.showExportModal(exportCode);
                });

            } catch (error) {
                console.error('导出数据失败:', error);
                alert('导出数据失败，请重试');
            }
        }

        function importDataFromClipboard() {
            const input = prompt('请粘贴座位布局与出勤记录代码：');

            if (!input || input.trim() === '') { return; }

            try {
                let importData;
                const trimmedInput = input.trim();

                if (trimmedInput.startsWith('SEAT_TXT_v1:')) {
                    const compactData = trimmedInput.substring(12);
                    if (!compactData) throw new Error('明文数据为空');
                    importData = DataManager.parseCompactTextFormat(compactData);
                } else if (trimmedInput.startsWith('SEAT_BIN_v1:')) {
                    const binaryData = trimmedInput.substring(12);
                    if (!binaryData) throw new Error('二进制数据为空');
                    const minimalData = JSON.parse(atob(binaryData));
                    importData = DataManager.parseBinaryFormat(minimalData);
                } else if (trimmedInput.startsWith('SEAT_DATA_v1:')) {
                    const encodedData = trimmedInput.substring(13);
                    if (!encodedData) throw new Error('旧版本数据为空');
                    const jsonString = decodeURIComponent(atob(encodedData));
                    importData = JSON.parse(jsonString); // 兼容旧版本结构
                } else {
                    throw new Error('无效的数据格式。');
                }

                if (!importData || !importData.className) { throw new Error('数据结构无效，缺少班级信息'); }

                if (!confirm(`将导入班级 ${importData.className} 的数据，覆盖当前显示？`)) { return; }

                if (classMode.value !== importData.className) {
                    classMode.value = importData.className;
                    UIRenderer.initClass();
                }

                if (importData.currentSeatLayout && importData.currentSeatLayout.seats) {
                    UIRenderer.restoreSeatLayoutToUI(importData.currentSeatLayout);
                }

                if (importData.currentAttendance && importData.currentAttendance.attendance) {
                    UIRenderer.restoreAttendanceToUI(importData.currentAttendance);
                }

                alert('数据导入成功！');

            } catch (error) {
                console.error('导入数据失败:', error);
                alert(`导入失败：${error.message}\n\n请检查：\n1. 代码是否完整\n2. 格式是否正确\n3. 班级数据是否存在`);
            }
        }

        function loadSeatLayout() {
            const selectedClass = classMode.value;
            if (!selectedClass) {
                alert('请先选择班级');
                return;
            }

            const seatLayoutKey = `${selectedClass}_seatLayout`;
            const savedLayout = localStorage.getItem(seatLayoutKey);

            if (!savedLayout) {
                alert('没有找到保存的座位布局');
                return;
            }

            try {
                const layoutData = JSON.parse(savedLayout);
                // 使用 UI 渲染器恢复布局
                UIRenderer.restoreSeatLayoutToUI(layoutData);
                alert('成功加载座位布局');
            } catch (error) {
                console.error('加载座位布局失败:', error);
                alert('加载座位布局失败');
            }
        }

        function loadAttendance() {
            const selectedClass = classMode.value;
            if (!selectedClass) {
                alert('请先选择班级');
                return;
            }

            const currentDate = dateToday.value;
            const classRecords = JSON.parse(localStorage.getItem(selectedClass)) || [];
            const record = classRecords.find(r => r.date === currentDate);

            if (record) {
                UIRenderer.restoreAttendanceToUI(record);
                alert(`成功载入 ${currentDate} 的出勤记录`);
            } else {
                alert(`未找到 ${currentDate} 的出勤记录`);
            }
        }

        function createCustomLayout() {
            const newRows = parseInt(rowInput.value);
            const newColumns = parseInt(colInput.value);
            const aisleConfigInput = aisleInput.value.trim();

            if (newRows < 1 || newRows > 15 || newColumns < 1 || newColumns < 15) {
                alert('行数和列数必须在1-15之间');
                return;
            }

            const newAisleColumns = parseAisleConfiguration(aisleConfigInput, newColumns);

            if (newAisleColumns.length > 0) {
                const maxAisle = Math.max(...newAisleColumns);
                if (maxAisle > newColumns) {
                    alert(`过道列号 ${maxAisle} 超出了总列数 ${newColumns}`);
                    return;
                }
            }

            rows = newRows;
            columns = newColumns;
            aisleColumns = newAisleColumns;

            DataManager.saveLayoutConfig();

            UIRenderer.initClass();

            const aisleInfo = aisleColumns.length > 0 ? `，过道位置: ${aisleColumns.join(', ')}` : '';
            alert(`已创建 ${rows} 行 ${columns} 列的座位布局${aisleInfo}`);
        }

        /**
         * 绑定所有事件监听器
         */
        function bindEvents() {
            classMode.addEventListener("change", UIRenderer.initClass);
            rollCallBtn.addEventListener("click", handleRollCall);
            saveBtn.addEventListener('click', saveAttendance);
            loadAttendanceBtn.addEventListener('click', loadAttendance);
            loadSeatBtn.addEventListener('click', loadSeatLayout);
            importSeatBtn.addEventListener('click', importDataFromClipboard);
            createLayoutBtn.addEventListener('click', createCustomLayout);
            trashBin.addEventListener('click', () => {
                UIRenderer.clearAttendanceArea(attendanceArea);
            });

            const container = document.querySelector("#container");
            container.addEventListener("dragover", dragOver);
            container.addEventListener("drop", drop);

            studentList.addEventListener("dragstart", dragStart);
            seatLayout.addEventListener("dragstart", dragStart);
            attendanceArea.addEventListener("dragstart", dragStart);

            seatLayout.addEventListener("click", toggleSeatColor);
            studentList.addEventListener("click", toggleSeatColor);

            const categoryTitlesContainer = document.querySelector('.attendance-title');
            categoryTitlesContainer.addEventListener('click', (event) => {
                if (event.target.tagName === 'H3') {
                    addGreenStudentsToAttendance(event);
                }
            });

            // 弹窗关闭事件
            if (closeRollCallModal) {
                closeRollCallModal.addEventListener('click', () => {
                    rollCallModal.style.display = "none";
                });
            }

            window.addEventListener('click', (event) => {
                if (event.target === rollCallModal) {
                    rollCallModal.style.display = "none";
                }
            });
        }

        return {
            bindEvents
        };
    })();

    // ========================
    // 7. 主应用初始化 (Main App Initialization)
    // ========================

    /**
     * 初始化应用
     */
    function init() {
        // 确保考勤类别已保存（用于 attendance.js）
        if (!localStorage.getItem(Config.LS_KEYS.ATTENDANCE_CATEGORIES)) {
            localStorage.setItem(Config.LS_KEYS.ATTENDANCE_CATEGORIES, JSON.stringify(Config.ATTENDANCE_CATEGORIES));
        }

        UIRenderer.initDate();
        UIRenderer.initClassSelection();

        // 加载保存的布局配置
        DataManager.loadLayoutConfig();

        UIRenderer.initSeatLayout();
        UIRenderer.initAttendanceArea();
        EventHandler.bindEvents();
    }

    // 返回公共API
    return {
        init
    };
})();

// 初始化应用 / Initialize application
document.addEventListener('DOMContentLoaded', app.init);