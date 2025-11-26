/**
 * 导航加载器模块：动态插入浮动导航栏并高亮当前页面
 */
document.addEventListener('DOMContentLoaded', function () {
    const navHtml = `
        <nav class="float-nav" role="navigation">
            <ul>
                <li><a href="1.点名与座位.html">点名与座位</a></li>
                <li><a href="2.出勤记录.html">出勤记录</a></li>
                <li><a href="3.班级数据管理.html">班级管理</a></li>
            </ul>
        </nav>
    `;

    // 1. 插入导航栏到 body 的最开始
    document.body.insertAdjacentHTML('afterbegin', navHtml);

    // 2. 标记当前活动链接
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.float-nav a');

    navLinks.forEach(link => {
        // 使用 endsWith 来判断当前页面是否匹配链接的 href 属性
        if (currentPath.endsWith(link.getAttribute('href'))) {
            // 默认 float-nav 的样式已经定义了链接颜色，这里仅添加 ARIA 属性增强可访问性
            link.setAttribute('aria-current', 'page');

            // 可以添加一个高亮类，比如让当前页面的链接颜色更深（如果需要额外的 CSS 样式）
            link.classList.add('active-nav-link');
        }
    });
});