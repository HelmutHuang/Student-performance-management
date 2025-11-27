// 初始化时从localStorage读取数据
let classes = JSON.parse(localStorage.getItem('classes') || '[]');
let currentEditIndex = -1; // 当前正在编辑的班级索引

// 批量导入学生
function importStudents() {
    const bulkInput = document.getElementById('bulkStudents').value;
    if (!bulkInput.trim()) {
        alert('请粘贴学生名单');
        return;
    }

    // 解析输入，支持换行和制表符分隔
    const names = bulkInput.split(/[\n\t]/)
        .map(name => name.trim())
        .filter(name => name);

    if (names.length === 0) {
        alert('未检测到有效学生姓名');
        return;
    }

    // 清空现有输入
    const studentList = document.getElementById('studentList');
    studentList.innerHTML = '';

    // 使用 DocumentFragment 优化性能
    const fragment = document.createDocumentFragment();

    // 添加所有学生
    names.forEach((name, index) => {
        const newStudent = document.createElement('div');
        newStudent.className = 'student-item';
        // 移除按钮，保留输入框
        newStudent.innerHTML = `<input type="text" class="student-name" value="${name}">`;
        // 提示用户双击删除
        newStudent.title = `${index + 1}`;
        fragment.appendChild(newStudent);
    });

    studentList.appendChild(fragment);

    // 清空批量输入框
    document.getElementById('bulkStudents').value = '';
}

// 删除学生输入框
function removeStudent(button) {
    const studentItem = button.parentElement;
    studentItem.remove();
}

// 添加班级
function addClass() {
    const className = document.getElementById('className').value;
    const studentNames = Array.from(document.querySelectorAll('#studentList .student-name'))
        .map(input => input.value.trim())
        .filter(name => name);

    if (!className || studentNames.length === 0) {
        alert('请填写班级名称和学生名单');
        return;
    }

    // 检查是否已存在同名班级
    const existingIndex = classes.findIndex(c => c.class === className);
    if (existingIndex !== -1) {
        const confirmOverwrite = confirm(`班级 ${className} 已存在，是否覆盖？`);
        if (!confirmOverwrite) {
            return; // 用户选择取消
        }
        // 覆盖现有班级
        classes[existingIndex] = {
            class: className,
            name: studentNames
        };
    } else {
        // 添加新班级
        classes.push({
            class: className,
            name: studentNames
        });
    }

    // 按班级名称排序
    classes.sort((a, b) => a.class.localeCompare(b.class));

    // 保存到localStorage
    localStorage.setItem('classes', JSON.stringify(classes));

    // 清空表单
    document.getElementById('className').value = '';
    const studentList = document.getElementById('studentList');
    studentList.innerHTML = '';

    // 更新显示
    displayClasses();
}

// 显示所有班级（按班级名称排序）
function displayClasses() {
    const sortedClasses = [...classes].sort((a, b) => a.class.localeCompare(b.class));
    const classList = document.getElementById('classList');
    classList.innerHTML = sortedClasses.map((cls, index) => `
        <div class="class-item">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3>${cls.class} (${cls.name.length}人)</h3>
                <div>
                    <button class="btn-sm btn-sm-green" onclick="editClass(${index})">编辑</button>
                    <button class="btn-sm btn-sm-red" onclick="removeClass(${index})">删除班级</button>
                </div>
            </div>
            <ul>
                ${cls.name.map(name => `<li>${name}</li>`).join('')}
            </ul>
        </div>
    `).join('');
}

// 删除班级并更新localStorage
function removeClass(index) {
    if (index >= 0 && index < classes.length) {
        if (!confirm(`确定要删除班级 ${classes[index].class} 吗？此操作不可恢复。`)) {
            return;
        }

        // 获取班级名称用于清理相关数据
        const className = classes[index].class;

        classes.splice(index, 1);
        localStorage.setItem('classes', JSON.stringify(classes));

        // 额外清理与班级相关的数据
        localStorage.removeItem(className); // 清理考勤记录
        localStorage.removeItem(`${className}_seatLayout`); // 清理座位布局
        localStorage.removeItem(`${className}_bonus`); // 清理加分数据

        displayClasses();
    }
}

// 页面加载时显示已有数据
function showClassData() {
    displayClasses();
}
showClassData();

// 双击删除学生项的事件委托
const studentListElement = document.getElementById('studentList');
studentListElement.addEventListener('dblclick', (event) => {
    // 确保双击的是 student-item 容器或其内部的 input
    let targetElement = event.target;
    if (targetElement.classList.contains('student-name')) {
        targetElement = targetElement.parentElement;
    }

    if (targetElement.classList.contains('student-item')) {
        targetElement.remove();
    }
});

// ==========================================
// 编辑班级相关功能
// ==========================================

function editClass(index) {
    currentEditIndex = index;
    const cls = classes[index];

    document.getElementById('editClassName').value = cls.class;
    renderEditStudentList(cls.name);

    document.getElementById('editClassModal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('editClassModal').style.display = 'none';
    currentEditIndex = -1;
}

function renderEditStudentList(studentNames) {
    const listContainer = document.getElementById('editStudentList');
    listContainer.innerHTML = '';

    studentNames.forEach((name, idx) => {
        const item = document.createElement('div');
        item.className = 'edit-student-item';
        item.draggable = true;
        item.innerHTML = `
            <span class="name">${name}</span>
            <span class="remove-btn" onclick="removeStudentFromEdit(${idx})">&times;</span>
        `;

        // 拖拽事件
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragenter', handleDragEnter);
        item.addEventListener('dragleave', handleDragLeave);
        item.addEventListener('dragend', handleDragEnd);

        listContainer.appendChild(item);
    });
}

function addStudentsToEditList() {
    const bulkInput = document.getElementById('editBulkStudents').value;
    if (!bulkInput.trim()) return;

    const newNames = bulkInput.split(/[\n\t]/)
        .map(name => name.trim())
        .filter(name => name);

    if (newNames.length > 0) {
        // 获取当前列表中的学生
        const currentNames = Array.from(document.querySelectorAll('#editStudentList .name')).map(span => span.textContent);
        const updatedNames = [...currentNames, ...newNames];
        renderEditStudentList(updatedNames);
        document.getElementById('editBulkStudents').value = '';
    }
}

function removeStudentFromEdit(index) {
    const currentNames = Array.from(document.querySelectorAll('#editStudentList .name')).map(span => span.textContent);
    currentNames.splice(index, 1);
    renderEditStudentList(currentNames);
}

function saveClassChanges() {
    if (currentEditIndex === -1) return;

    const newClassName = document.getElementById('editClassName').value.trim();
    const newStudentNames = Array.from(document.querySelectorAll('#editStudentList .name')).map(span => span.textContent);

    if (!newClassName || newStudentNames.length === 0) {
        alert('班级名称和学生名单不能为空');
        return;
    }

    const oldClassName = classes[currentEditIndex].class;

    // 如果修改了班级名称，检查是否冲突
    if (newClassName !== oldClassName) {
        const conflictIndex = classes.findIndex(c => c.class === newClassName);
        if (conflictIndex !== -1 && conflictIndex !== currentEditIndex) {
            alert(`班级名称 ${newClassName} 已存在，请使用其他名称`);
            return;
        }

        // 迁移数据
        const attendanceData = localStorage.getItem(oldClassName);
        const seatLayoutData = localStorage.getItem(`${oldClassName}_seatLayout`);
        const bonusData = localStorage.getItem(`${oldClassName}_bonus`);

        if (attendanceData) localStorage.setItem(newClassName, attendanceData);
        if (seatLayoutData) localStorage.setItem(`${newClassName}_seatLayout`, seatLayoutData);
        if (bonusData) localStorage.setItem(`${newClassName}_bonus`, bonusData);

        // 删除旧数据
        localStorage.removeItem(oldClassName);
        localStorage.removeItem(`${oldClassName}_seatLayout`);
        localStorage.removeItem(`${oldClassName}_bonus`);
    }

    // 更新班级数据
    classes[currentEditIndex] = {
        class: newClassName,
        name: newStudentNames
    };

    // 重新排序并保存
    classes.sort((a, b) => a.class.localeCompare(b.class));
    localStorage.setItem('classes', JSON.stringify(classes));

    closeEditModal();
    displayClasses();
    alert('班级信息已更新');
}

// 拖拽排序相关变量和函数
let dragSrcEl = null;

function handleDragStart(e) {
    dragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
    this.classList.add('dragging');
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    this.classList.add('over');
}

function handleDragLeave(e) {
    this.classList.remove('over');
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }

    if (dragSrcEl !== this) {
        // 交换内容是不够的，我们需要交换DOM元素或者重新渲染列表
        // 这里简单地交换 innerHTML，但在更复杂的场景下应该交换数据模型并重新渲染
        // 为了保持事件绑定，最好是交换数据模型

        const listContainer = document.getElementById('editStudentList');
        const items = Array.from(listContainer.children);
        const srcIndex = items.indexOf(dragSrcEl);
        const targetIndex = items.indexOf(this);

        const currentNames = items.map(item => item.querySelector('.name').textContent);

        // 移动数组元素
        const [movedItem] = currentNames.splice(srcIndex, 1);
        currentNames.splice(targetIndex, 0, movedItem);

        renderEditStudentList(currentNames);
    }

    return false;
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    const items = document.querySelectorAll('.edit-student-item');
    items.forEach(item => item.classList.remove('over'));
}

// 点击弹窗外部关闭
window.onclick = function (event) {
    const modal = document.getElementById('editClassModal');
    if (event.target == modal) {
        closeEditModal();
    }
}