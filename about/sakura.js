
        // 生成樱花花瓣
        document.addEventListener('DOMContentLoaded', function() {
            const container = document.getElementById('sakuraContainer');
            const count = 20;
            for (let i = 0; i < count; i++) {
                const sakura = document.createElement('div');
                sakura.className = 'sakura';
                sakura.style.left = Math.random() * 100 + '%';
                sakura.style.width = (12 + Math.random() * 16) + 'px';
                sakura.style.height = sakura.style.width;
                sakura.style.animationDuration = (8 + Math.random() * 12) + 's';
                sakura.style.animationDelay = (Math.random() * 10) + 's';
                sakura.style.opacity = 0.3 + Math.random() * 0.4;
                container.appendChild(sakura);
            }
        });
    