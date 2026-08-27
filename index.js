document.addEventListener('DOMContentLoaded', () => {
    let number = 0;

    function addItem() {
        const content = document.getElementById('Content');
        if (!content) return;
        const p = document.createElement('p');
        const input = document.createElement('input');
        input.id = `item-${number}`;
        input.name = `item-${number}`;
        input.placeholder = "請輸入網址";
        input.className = 'input-text';
        input.type = 'text';
        const delBtn = document.createElement('button');
        const div = document.createElement('div');
        delBtn.appendChild(div);
        div.textContent = '-';
        delBtn.className = 'del';
        delBtn.type = 'button';

        delBtn.addEventListener('click', () => {
            if(number > 1) p.remove();
        });

        p.appendChild(input);
        p.appendChild(delBtn);
        content.appendChild(p);

        number++;
    };

    // 預設新增
    document.getElementById('Add')?.addEventListener('click', () => {
        addItem();
    });

    document.querySelector('#myForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        document.getElementById('load').style.display = 'block';
        //document.getElementById('load')?.style.display = 'none';

        const inputs = document.querySelectorAll('.input-text');
        const urlArray = Array.from(inputs)
            .map(input => input.value.trim())
            .filter(value => value !== '');

        try {
            const response = await fetch('/api/richData', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ urls: urlArray })
            });

            if (response.ok) {
                const htmlContent = await response.text();

                // 1. 將 HTML 字串轉為 Blob 物件
                const blob = new Blob([htmlContent], { type: 'text/html; charset=utf-8' });
                
                // 2. 產生臨時的網址並直接跳轉
                window.location.href = URL.createObjectURL(blob);
            } else {
                alert('解析失敗，請確認網址是否正確');
                document.getElementById('load').style.display = 'none';
            }
        } catch (error) {
            console.error('發送失敗:', error);
        }
    });

    addItem();
});