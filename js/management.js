// 初始化时从localStorage读取数据
let classes = JSON.parse(localStorage.getItem('classes') || '[]');

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
    const studentNames = Array.from(document.querySelectorAll('.student-name'))
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
                <button class="btn btn-danger" onclick="removeClass(${index})">删除班级</button>
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