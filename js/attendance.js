document.addEventListener('DOMContentLoaded', () => {
    const classes = JSON.parse(localStorage.getItem('classes')) || [];
    const classSelect = document.getElementById("classSelect");
    const modal = document.getElementById("studentModal");
    const closeBtn = document.querySelector(".close-btn");
    const allAttendanceBtn = document.getElementById("allAttendanceBtn");
    const allAttendanceModal = document.getElementById("allAttendanceModal");
    const allAttendanceCloseBtn = document.querySelector(".all-attendance-close-btn");
    const copyAllAttendanceTableBtn = document.getElementById("copyAllAttendanceTableBtn");

    const editRecordModal = document.getElementById("editRecordModal");
    const editCloseBtn = document.getElementById("editCloseBtn");
    const saveEditedRecordBtn = document.getElementById("saveEditedRecordBtn");
    const editFormContainer = document.getElementById("editFormContainer");
    const editDateInput = document.getElementById("editDateInput");
    let currentEditingRecord = null; // 用于存储当前正在编辑的记录对象
    let currentEditingClass = null; // 用于存储当前正在编辑的班级

    // 新增：关闭编辑弹窗
    editCloseBtn.addEventListener('click', () => {
        editRecordModal.style.display = "none";
    });

    // 新增：点击弹窗外部关闭编辑弹窗
    window.addEventListener('click', (e) => {
        if (e.target === editRecordModal) {
            editRecordModal.style.display = "none";
        }
    });

    // 新增：保存编辑记录的按钮事件
    saveEditedRecordBtn.addEventListener('click', () => {
        saveEditedRecord();
    });

    // 关闭弹窗
    closeBtn.addEventListener('click', () => {
        modal.style.display = "none";
    });

    // 点击弹窗外部关闭弹窗
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = "none";
        }
    });

    // 全部出勤按钮事件
    allAttendanceBtn.addEventListener('click', () => {
        showAllAttendanceRecords();
    });

    // 关闭全部出勤弹窗
    allAttendanceCloseBtn.addEventListener('click', () => {
        allAttendanceModal.style.display = "none";
    });

    // 点击全部出勤弹窗外部关闭弹窗
    window.addEventListener('click', (e) => {
        if (e.target === allAttendanceModal) {
            allAttendanceModal.style.display = "none";
        }
    });

    // 复制表格按钮事件
    copyAllAttendanceTableBtn.addEventListener('click', () => {
        copyAllAttendanceRecordsToClipboard();
    });

    initClassSelect(classes, classSelect);


    classSelect.addEventListener('change', (e) => {
        const selectedClass = e.target.value;
        if (!selectedClass) {
            // 隐藏复制按钮当没有选择班级时
            // 注意: copyScoresBtn 变量未定义，这里使用 allAttendanceBtn 来处理显示状态
            document.getElementById('allAttendanceBtn').style.display = 'none';
            document.querySelector('#student-list-table tbody').innerHTML = '';
            document.querySelector('.record-container').innerHTML = '';
            return;
        }

        const records = JSON.parse(localStorage.getItem(selectedClass)) || [];
        displayRecords(records);
        displayStudentList(selectedClass);
    });
});

function initClassSelect(classes, classSelect) {
    classes.forEach(cls => {
        const option = document.createElement('option');
        option.value = cls.class;
        option.textContent = cls.class;
        classSelect.appendChild(option);
    });
}

function displayRecords(records) {
    const container = document.querySelector('.record-container');
    container.innerHTML = '';

    records.forEach(record => {
        const card = document.createElement('div');
        card.className = 'record-card';

        const date = document.createElement('div');
        date.className = 'record-date';
        date.textContent = `日期：${record.date}`;

        // 新增：按钮容器
        const buttonContainer = document.createElement('span');

        // 新增：编辑按钮
        const editBtn = document.createElement('button');
        editBtn.className = 'btn-edit';
        editBtn.textContent = '编辑';
        editBtn.addEventListener('click', () => {
            const selectedClass = document.getElementById("classSelect").value;
            openEditModal(selectedClass, record); // 调用新的编辑函数
        });
        buttonContainer.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-delete';
        deleteBtn.textContent = '删除';
        deleteBtn.addEventListener('click', () => {
            if (confirm('确定要删除这条记录吗？')) {
                const selectedClass = document.getElementById("classSelect").value;
                const updatedRecords = records.filter(r => r.date !== record.date);
                localStorage.setItem(selectedClass, JSON.stringify(updatedRecords));
                displayRecords(updatedRecords);
                // 重新显示学生列表以更新分数
                displayStudentList(selectedClass);
            }
        });
        buttonContainer.appendChild(deleteBtn);

        // 将按钮容器添加到日期行
        date.appendChild(buttonContainer);

        const details = document.createElement('div');
        details.className = 'record-details';

        Object.entries(record.attendance).forEach(([category, students]) => {
            const studentCount = {};
            students.forEach(student => {
                if (studentCount[student]) {
                    studentCount[student]++;
                } else {
                    studentCount[student] = 1;
                }
            });

            const formattedStudents = Object.entries(studentCount).map(([student, count]) => {
                return count > 1 ? `${student}x${count}` : student;
            });

            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'record-category';
            categoryDiv.innerHTML = `<strong>${category}</strong>: ${formattedStudents.join('、')}`;
            details.appendChild(categoryDiv);
        });

        card.appendChild(date);
        card.appendChild(details);
        container.appendChild(card);
    });
}

function displayStudentList(selectedClass) {
    const classData = JSON.parse(localStorage.getItem('classes')).find(cls => cls.class === selectedClass);
    if (!classData) return;

    const tableBody = document.querySelector('#student-list-table tbody');
    tableBody.innerHTML = '';

    const attendanceCategories = JSON.parse(localStorage.getItem('attendanceCategories')) || [];
    const records = JSON.parse(localStorage.getItem(selectedClass)) || [];

    // 获取学生额外加分数据
    const bonusScores = JSON.parse(localStorage.getItem(`${selectedClass}_bonus`)) || {};

    const studentScores = [];

    classData.name.forEach(student => {
        let totalScore = 100;
        let baseScore = 100; // 记录基础分数

        records.forEach(record => {
            Object.entries(record.attendance).forEach(([category, students]) => {
                const categoryData = attendanceCategories.find(cat => cat.category === category);
                if (categoryData) {
                    students.forEach(attendingStudent => {
                        if (attendingStudent === student) {
                            baseScore -= categoryData.score;
                        }
                    });
                }
            });
        });

        // 添加额外加分
        const bonusScore = bonusScores[student] || 0;
        totalScore = baseScore + bonusScore;

        studentScores.push({ student, totalScore, baseScore, bonusScore });
    });

    // 新的最终分数计算方法：基于满分群体平均分的线性缩放

    // 1. 找出所有原始分数超过100分的学生
    const highScoreStudents = studentScores.filter(score => score.totalScore > 100);

    // 2. 计算满分群体平均分（Benchmark）
    let benchmark = 100; // 默认值，如果没有超过100分的学生
    if (highScoreStudents.length > 0) {
        const sumHighScores = highScoreStudents.reduce((sum, student) => sum + student.totalScore, 0);
        benchmark = sumHighScores / highScoreStudents.length;
    }

    // 3. 计算缩放因子（ScaleFactor）
    const scaleFactor = 100 / benchmark;

    studentScores.forEach(({ student, totalScore, baseScore, bonusScore }, index) => {
        const row = document.createElement('tr');
        const numberCell = document.createElement('td');
        const nameCell = document.createElement('td');
        const scoreCell = document.createElement('td');
        const finalScoreCell = document.createElement('td');
        const actionCell = document.createElement('td');

        numberCell.textContent = index + 1;

        // 为学生姓名添加点击事件和样式
        nameCell.textContent = student;
        nameCell.className = 'student-name';
        nameCell.addEventListener('click', () => {
            showStudentAttendanceSummary(student, selectedClass);
        });

        // 显示原始分数和额外加分（如果有）
        if (bonusScore > 0) {
            scoreCell.innerHTML = `${baseScore}<span class="bonus-score">+${bonusScore}</span>`;
        } else if (bonusScore < 0) {
            scoreCell.innerHTML = `${baseScore}<span class="bonus-score">${bonusScore}</span>`;
        } else {
            scoreCell.textContent = totalScore;
        }

        // 4. 计算所有学生的最终成绩（FinalScore）
        let finalScore = Math.round(totalScore * scaleFactor);

        // 最终分数大于100分则为100
        finalScore = Math.min(100, finalScore);
        // 确保最终分数不小于0
        finalScore = Math.max(0, finalScore);

        finalScoreCell.textContent = finalScore.toFixed(0);

        // 添加加分按钮
        const bonusBtn = document.createElement('button');
        bonusBtn.className = 'btn-bonus';
        bonusBtn.textContent = '修改';
        bonusBtn.addEventListener('click', () => {
            const currentBonus = bonusScores[student] || 0;
            const input = prompt(`为 ${student} 加分，当前额外加分：${currentBonus}\n请输入新的加分值（正数为加分，负数为减分）：`);

            if (input !== null) {
                const bonusValue = parseInt(input);
                if (!isNaN(bonusValue)) {
                    // 更新加分数据
                    bonusScores[student] = bonusValue;
                    localStorage.setItem(`${selectedClass}_bonus`, JSON.stringify(bonusScores));

                    // 重新显示学生列表
                    displayStudentList(selectedClass);
                } else {
                    alert('请输入有效的数字！');
                }
            }
        });

        actionCell.appendChild(bonusBtn);

        row.appendChild(numberCell);
        row.appendChild(nameCell);
        row.appendChild(scoreCell);
        row.appendChild(finalScoreCell);
        row.appendChild(actionCell);

        tableBody.appendChild(row);
    });

    // 显示全部出勤按钮（当有学生数据时）
    const allAttendanceBtn = document.getElementById('allAttendanceBtn');
    if (studentScores.length > 0) {
        allAttendanceBtn.style.display = 'inline-block';
    } else {
        allAttendanceBtn.style.display = 'none';
    }
}

// 显示学生考勤汇总
function showStudentAttendanceSummary(studentName, selectedClass) {
    const modal = document.getElementById("studentModal");
    const summaryContainer = document.getElementById("attendanceSummary");
    const modalTitle = document.querySelector(".modal-title");

    modalTitle.textContent = `${studentName} - 考勤汇总`;
    summaryContainer.innerHTML = '';

    const records = JSON.parse(localStorage.getItem(selectedClass)) || [];
    const attendanceCategories = JSON.parse(localStorage.getItem('attendanceCategories')) || [];

    // 初始化考勤统计
    const attendanceSummary = {};
    attendanceCategories.forEach(cat => {
        attendanceSummary[cat.category] = 0;
    });

    // 统计每种考勤类型的次数
    records.forEach(record => {
        Object.entries(record.attendance).forEach(([category, students]) => {
            if (students.includes(studentName)) {
                attendanceSummary[category] = (attendanceSummary[category] || 0) + 1;
            }
        });
    });

    // 创建汇总项
    Object.entries(attendanceSummary).forEach(([category, count]) => {
        if (count > 0) {
            const summaryItem = document.createElement('div');
            summaryItem.className = 'summary-item';

            const countElement = document.createElement('div');
            countElement.className = 'summary-count';
            countElement.textContent = count;

            const labelElement = document.createElement('div');
            labelElement.className = 'summary-label';
            labelElement.textContent = category;

            summaryItem.appendChild(countElement);
            summaryItem.appendChild(labelElement);
            summaryContainer.appendChild(summaryItem);
        }
    });

    // 如果没有任何考勤记录
    if (Object.values(attendanceSummary).every(count => count === 0)) {
        const noRecordItem = document.createElement('div');
        noRecordItem.style.textAlign = 'center';
        noRecordItem.style.gridColumn = '1 / -1';
        noRecordItem.textContent = '该学生没有任何考勤记录';
        summaryContainer.appendChild(noRecordItem);
    }

    // 显示弹窗
    modal.style.display = "block";
}

// 复制全部出勤表格到剪贴板
function copyAllAttendanceRecordsToClipboard() {
    const tableContainer = document.getElementById('allAttendanceTableContainer');
    const table = tableContainer.querySelector('table');

    if (!table) {
        alert('没有表格数据可复制！');
        return;
    }

    // 获取表格的所有行
    const rows = table.querySelectorAll('tr');
    let csvContent = '';

    // 遍历所有行和单元格，构建CSV格式
    rows.forEach((row) => {
        const cells = row.querySelectorAll('th, td');
        const rowData = [];

        cells.forEach(cell => {
            // 获取单元格文本内容并处理特殊字符
            let cellText = cell.textContent.trim();
            // 如果内容包含逗号、换行符或双引号，需要用双引号包围并转义双引号
            if (cellText.includes(',') || cellText.includes('\n') || cellText.includes('"')) {
                cellText = `"${cellText.replace(/"/g, '""')}"`;
            }
            rowData.push(cellText);
        });

        csvContent += rowData.join('\t') + '\n'; // 使用制表符分隔，便于Excel粘贴
    });

    // 复制到剪贴板
    navigator.clipboard.writeText(csvContent).then(() => {
        // 显示一个临时提示
        const notification = document.createElement('div');
        notification.textContent = '已复制表格到剪贴板！';
        notification.style.position = 'fixed';
        notification.style.bottom = '20px';
        notification.style.right = '20px';
        notification.style.backgroundColor = 'teal';
        notification.style.color = 'white';
        notification.style.padding = '10px 20px';
        notification.style.borderRadius = '5px';
        notification.style.zIndex = '1000';
        notification.style.transition = 'opacity 0.5s';
        notification.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';

        document.body.appendChild(notification);

        // 3秒后淡出提示
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 500);
        }, 3000);
    }).catch(err => {
        console.error('复制失败:', err);
        alert('复制失败，请重试！');
    });
}

// 显示全部出勤记录
function showAllAttendanceRecords() {
    const selectedClass = document.getElementById("classSelect").value;
    if (!selectedClass) {
        alert('请先选择班级');
        return;
    }

    const classData = JSON.parse(localStorage.getItem('classes')).find(cls => cls.class === selectedClass);
    if (!classData) return;

    const attendanceCategories = JSON.parse(localStorage.getItem('attendanceCategories')) || [];
    const records = JSON.parse(localStorage.getItem(selectedClass)) || [];
    const bonusScores = JSON.parse(localStorage.getItem(`${selectedClass}_bonus`)) || {};

    // 计算每个学生的各项考勤次数
    const studentAttendance = {};
    classData.name.forEach(student => {
        studentAttendance[student] = {};
        attendanceCategories.forEach(category => {
            studentAttendance[student][category.category] = 0;
        });
    });

    // 统计每个学生的考勤情况
    records.forEach(record => {
        Object.entries(record.attendance).forEach(([category, students]) => {
            students.forEach(student => {
                if (studentAttendance[student]) {
                    studentAttendance[student][category] = (studentAttendance[student][category] || 0) + 1;
                }
            });
        });
    });

    // 计算每个学生的分数
    const studentScores = [];
    classData.name.forEach((student, index) => {
        let totalScore = 100;
        let bonusScore = bonusScores[student] || 0;

        // 计算扣分
        attendanceCategories.forEach(categoryData => {
            const count = studentAttendance[student][categoryData.category] || 0;
            totalScore -= count * categoryData.score;
        });

        // 添加加分
        totalScore += bonusScore;

        studentScores.push({
            index: index + 1,
            name: student,
            bonus: bonusScore,
            late: studentAttendance[student]['迟'] || 0,
            leave: studentAttendance[student]['假'] || 0,
            absent: studentAttendance[student]['旷'] || 0,
            sleep: studentAttendance[student]['睡'] || 0,
            play: studentAttendance[student]['玩'] || 0,
            totalScore: totalScore,
        });
    });

    // 新的最终分数计算方法：基于满分群体平均分的线性缩放
    // 1. 找出所有原始分数超过100分的学生
    const highScoreStudents = studentScores.filter(score => score.totalScore > 100);

    // 2. 计算满分群体平均分（Benchmark）
    let benchmark = 100; // 默认值，如果没有超过100分的学生
    if (highScoreStudents.length > 0) {
        const sumHighScores = highScoreStudents.reduce((sum, student) => sum + student.totalScore, 0);
        benchmark = sumHighScores / highScoreStudents.length;
    }

    // 3. 计算缩放因子（ScaleFactor）
    const scaleFactor = 100 / benchmark;

    // 4. 计算所有学生的最终成绩（FinalScore）
    studentScores.forEach(student => {
        let finalScore = Math.round(student.totalScore * scaleFactor);
        // 最终分数大于100分则为100
        finalScore = Math.min(100, finalScore);
        // 确保最终分数不小于0
        finalScore = Math.max(0, finalScore);
        student.finalScore = finalScore;
    });

    // 生成表格HTML
    let tableHTML = `
        <table class="all-attendance-table">
            <thead>
                <tr>
                    <th>序号</th>
                    <th>姓名</th>
                    <th>加分</th>
                    <th>迟到</th>
                    <th>请假</th>
                    <th>旷课</th>
                    <th>睡觉</th>
                    <th>玩手机/游戏</th>
                    <th>统计分数</th>
                    <th>最终成绩</th>
                </tr>
            </thead>
            <tbody>
    `;

    studentScores.forEach(student => {
        tableHTML += `
            <tr>
                <td>${student.index}</td>
                <td>${student.name}</td>
                <td>${student.bonus}</td>
                <td>${student.late}</td>
                <td>${student.leave}</td>
                <td>${student.absent}</td>
                <td>${student.sleep}</td>
                <td>${student.play}</td>
                <td>${student.totalScore}</td>
                <td>${student.finalScore}</td>
            </tr>
        `;
    });

    tableHTML += `
            </tbody>
        </table>
    `;

    // 显示表格
    document.getElementById('allAttendanceTableContainer').innerHTML = tableHTML;
    document.getElementById('allAttendanceModal').style.display = 'block';
}

/**
 * 打开编辑弹窗并填充表单 (新增日期处理和网格渲染)
 * @param {string} selectedClass - 班级名称
 * @param {Object} record - 考勤记录对象
 */
function openEditModal(selectedClass, record) {
    currentEditingRecord = record;
    currentEditingClass = selectedClass;

    document.getElementById('editModalTitle').textContent = `编辑 ${record.date} 的考勤记录`;
    editFormContainer.innerHTML = '';

    // 1. 设置日期输入框的值
    editDateInput.value = record.date;

    const attendanceCategories = JSON.parse(localStorage.getItem('attendanceCategories')) || [];

    // 2. 为每个考勤类别创建编辑区，使用新的样式类
    attendanceCategories.forEach(cat => {
        const categoryName = cat.category;
        const students = record.attendance[categoryName] || [];

        const div = document.createElement('div');
        div.className = 'edit-area-item'; // 使用新的样式类
        div.innerHTML = `
            <label class="edit-label" style="display: block; margin-bottom: 5px;">${categoryName} (${cat.score}分/次) :</label>
            <textarea 
                id="edit-${categoryName}" 
                class="edit-textarea"
                placeholder="请输入学生姓名，以逗号、空格或换行分隔"
            >${students.join(', ')}</textarea>
        `;
        editFormContainer.appendChild(div);
    });

    editRecordModal.style.display = "block";
}

/**
 * 保存编辑后的考勤记录 (新增日期修改逻辑)
 */
function saveEditedRecord() {
    if (!currentEditingRecord || !currentEditingClass) {
        alert('编辑数据丢失，请刷新重试。');
        return;
    }

    const selectedClass = currentEditingClass;
    let records = JSON.parse(localStorage.getItem(selectedClass)) || [];
    const attendanceCategories = JSON.parse(localStorage.getItem('attendanceCategories')) || [];

    const originalDate = currentEditingRecord.date;
    const newDate = editDateInput.value.trim(); // 获取新的日期

    if (!newDate) {
        alert('日期不能为空！');
        return;
    }

    // 1. 检查新日期是否冲突
    let newRecordExists = false;
    if (newDate !== originalDate) {
        newRecordExists = records.some(r => r.date === newDate);
    }

    // 2. 收集新的考勤数据
    const newAttendance = {};
    attendanceCategories.forEach(cat => {
        const categoryName = cat.category;
        const textarea = document.getElementById(`edit-${categoryName}`);

        if (textarea) {
            // 解析输入，支持逗号、空格或换行分隔
            const names = textarea.value.split(/[, \n]/)
                .map(name => name.trim())
                .filter(name => name.length > 0);

            newAttendance[categoryName] = names;
        }
    });

    const newRecord = {
        date: newDate,
        attendance: newAttendance
    };

    // 3. 处理记录的更新/迁移/覆盖逻辑
    if (newDate === originalDate) {
        // 日期未变，找到原始记录的索引并直接更新
        const recordIndex = records.findIndex(r => r.date === originalDate);
        if (recordIndex !== -1) {
            records[recordIndex] = newRecord;
        }
    } else {
        // 日期改变
        if (newRecordExists) {
            // 新日期已存在，询问是否覆盖
            if (!confirm(`日期 ${newDate} 的记录已存在，确定要用当前编辑的内容覆盖它吗？\n（原始记录 ${originalDate} 将被删除）`)) {
                return;
            }
            // 覆盖：先删除旧日期记录，再删除新日期记录，最后添加新记录
            records = records.filter(r => r.date !== originalDate); // 删除原始记录
            records = records.filter(r => r.date !== newDate);      // 删除冲突记录
            records.push(newRecord);
        } else {
            // 新日期不存在，移除旧记录，插入新记录
            records = records.filter(r => r.date !== originalDate);
            records.push(newRecord);
        }
    }

    // 重新排序记录
    records.sort((a, b) => a.date.localeCompare(b.date));

    // 保存到本地存储
    localStorage.setItem(selectedClass, JSON.stringify(records));

    // 关闭弹窗
    editRecordModal.style.display = "none";

    // 刷新 UI
    displayRecords(records);
    displayStudentList(selectedClass); // 必须刷新学生列表以更新分数

    // 更新 currentEditingRecord 以防用户立即再次编辑
    currentEditingRecord = newRecord;

    alert(`班级 ${selectedClass} 日期 ${newDate} 的记录已成功更新！`);
}