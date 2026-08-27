import { createServer } from 'node:http';
import { readFile } from 'node:fs';
import { extname, join } from 'node:path';
import { exec } from 'node:child_process';
import axios from 'axios';
import * as cheerio from 'cheerio';

const server = createServer((req, res) => {
	res.setHeader("Access-Control-Allow-Origin", '*');	
	const targetUrl = req.url === '/' ? 'index.html' : req.url;
	switch(targetUrl){
		case "/api/richData":{
			let body = '';

			// 1. 監聽 data 事件，收集前端傳過來的封包資料
			req.on('data', chunk => {
				body += chunk.toString();
			});

			// 2. 監聽 end 事件，當資料接收完畢時處理
			req.on('end', async() => {
				try {
					const parsedData = JSON.parse(body);
					const googleDriveFileUrlArray = parsedData.urls; 
					
					// 1. 等待 printData 解析並產生 HTML 字串
					const html = await printData(googleDriveFileUrlArray);

					if (!html) {
						res.writeHead(500, { 'Content-Type': 'application/json' });
						return res.end(JSON.stringify({ status: 'error', message: '無法解析文件內容' }));
					}

					// 2. 設定 Content-Type 為 text/html，回傳 HTML 給前端
					res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
					res.end(html);

				} catch (err) {
					res.writeHead(400, { 'Content-Type': 'application/json' });
					res.end(JSON.stringify({ status: 'error', message: 'JSON 格式錯誤' }));
				}
			});
			//printData();
		}
		break;
		default:{
			const safePath = join(process.cwd(), decodeURIComponent(targetUrl));
			readFile(safePath, (err, data) => {
				if (err) {
					res.writeHead(404, { 'Content-Type': 'text/plain' });
					res.end('File Not Found\n');
				} else {
					const ext = extname(safePath);
					let contentType = '';

					switch(ext){
						case '.js':
							contentType = 'application/javascript';
							break;
						case '.css':
							contentType = 'text/css';
							break;
						case '.json':
							contentType = 'application/json';
							break;
						case '.png':
							contentType = 'image/png';
							break;
						default:
							contentType = 'text/html';
							break;
					}

					res.writeHead(200, {
						'Content-Type': contentType,
						"Access-Control-Allow-Origin": "*",
						"Access-Control-Allow-Headers": "X-Token,Content-Type",
						"Access-Control-Allow-Methods": "PUT"
					});
					res.end(data);
				}
			});
		}
		break;
	}
});

const port = process.env.PORT || 4000;
// 傳入 0 讓系統自動分配空閒 Port
server.listen(port, () => {
	const url = `http://localhost:${port}/`;
	const startCmd = process.platform === 'darwin' ? 'open' : 
                     process.platform === 'win32' ? 'start' : 'xdg-open';
	exec(`${startCmd} ${url}`);
});

function generateHtml(urlHtml, commitTitle, formattedJsonText) {
	//const formattedJsonText = JSON.stringify(txt, null, 2);
    return `
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head>
        <meta charset="UTF-8">
        <title>活動文案預覽</title>
        <style>
            body { font-family: sans-serif; padding: 20px; line-height: 1.6; text-align: center; }
            strong {
                -webkit-user-select: none;
                -moz-user-select: none;
                -ms-user-select: none;
                user-select: none;
            }
            .box { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 15px; }
            button { margin-left: 8px; cursor: pointer; }
        </style>
    </head>
    <body>
        <div class="box">
            <strong>標題：</strong>
            <button id="copyTitleBtn">複製標題</button>
            <div id="titleContent">${commitTitle}</div>
        </div>
        <div class="box">
            <strong>連結：</strong><button id="copyLinkBtn">複製聯結</button>
            <div id="linkContent">${urlHtml}</div>
        </div>
        <div class="box">
            <strong>內容：</strong>
			<button id="copyTxtBtn">複製內容</button> 請貼到 CustomizeContent.ts 的Array裡
            <div id="txtContent" style="text-align: left;">${formattedJsonText}</div>
        </div>
        <strong>偶爾會錯誤，匯出後最好再比對一下數量<br/>若發生錯誤請到Git將檔案重置</strong>

        <script>
            // 改用 Blob 跳轉後，DOMContentLoaded 就會正常觸發！
            document.addEventListener('DOMContentLoaded', () => {
                document.getElementById('copyTitleBtn').addEventListener('click', () => {
                    const titleText = document.getElementById('titleContent').innerText;
                    copyTextFallback(titleText);
                });

				document.getElementById('copyLinkBtn').addEventListener('click', () => {
					const linkHtml = document.getElementById('linkContent').innerHTML;
					copyRichText(linkHtml);
				});

				document.getElementById('copyTxtBtn').addEventListener('click', () => {
                    const text = document.getElementById('txtContent').innerText;
                    copyTextFallback(text);
                });
            });

            function copyTextFallback(textToCopy) {
                const textarea = document.createElement('textarea');
                textarea.value = textToCopy;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);

                textarea.select();
                textarea.setSelectionRange(0, 99999);

                try {
                    const successful = document.execCommand('copy');
                    if (successful) {
                        alert('已複製內容！');
                    } else {
                        alert('複製失敗');
                    }
                } catch (err) {
                    console.error('複製失敗:', err);
                }

                document.body.removeChild(textarea);
            }

			async function copyRichText(htmlString) {
				try {
					const blobInput = new Blob([htmlString], { type: 'text/html' });
					const clipboardItem = new ClipboardItem({ 'text/html': blobInput });
					await navigator.clipboard.write([clipboardItem]);
					alert('已複製超連結內容！');
				} catch (err) {
					console.error('複製失敗:', err);
				}
			}
        </script>
    </body>
    </html>
    `;
}

async function printData(googleDriveFileUrlArray) {
    //readFileContent();
    
    const results = await Promise.all(googleDriveFileUrlArray.map(item => readPublicDoc(item)));
    const objArray = results.filter(item => item !== null);

    if (objArray.length === 0) {
        console.error('沒有成功抓取到任何文件內容！');
        return;
    }
    // 組合 HTML 內容
    let commitTitle = `[APP][MODIFY] 活動榜 - 文案修改`;
    let urlHtml = ``;

    const titleList = objArray.map(item => item.title);
    titleList.forEach((item, index) => {
        commitTitle += (index === 0) ? `"${item}"` : `、"${item}"`;
        urlHtml += `<a href="${objArray[index].url}" target="_blank">${item}</a><br/>`;
    });
	const newArray = objArray.map(({ url, ...rest }) => rest);

    let txt = await writeFileContent(objArray);
    return generateHtml(urlHtml, commitTitle, txt);
}

async function readPublicDoc(url) {
	try {
		const res = await axios.get(url);
		const $ = cheerio.load(res.data);

		let fullContent = '';

		// 把該文件內所有 DOCS_modelChunk 文字全部合併（解決分塊問題）
		$('script').each((i, el) => {
			const scriptContent = $(el).html();
			if (scriptContent && scriptContent.includes('DOCS_modelChunk = {"chunk"')) {
				const match = scriptContent.match(/\{[^}]*\}/);
				if (match) {
					try {
						const parsed = JSON.parse(match[0] + ']}');
						if (parsed.chunk && parsed.chunk[0] && parsed.chunk[0].s) {
							fullContent += parsed.chunk[0].s;
						}
					} catch (e) {
						// 忽略格式不符的 chunk
					}
				}
			}
		});

		// 如果完全沒抓到內容，直接回傳 null
		if (!fullContent) return null;

		// 從完整內容解析關鍵字
		const title = fullContent.substring(0, fullContent.indexOf('活動時間：') - 1).replace(/\n/g, ' ').trim();
		const date = fullContent.substring(fullContent.indexOf('活動時間：') + 5, fullContent.indexOf('活動資格：') - 1).replace(/\n/g, ' ');
		const qualifications = fullContent.substring(fullContent.indexOf('活動資格：') + 5, fullContent.indexOf('活動規則：') - 1).replace(/\n/g, ' ');
		const rule = fullContent.substring(fullContent.indexOf('活動規則：') + 5, fullContent.indexOf('活動獎項：') - 1).split(/\n/g);
		const award = fullContent.substring(fullContent.indexOf('活動獎項：') + 5, fullContent.indexOf('注意事項：') - 1).split(/\n/g);
		const remark = fullContent.substring(fullContent.indexOf('注意事項：') + 5, fullContent.indexOf('\n-\n') - 1).split(/\n(?!例\s*:)/g);

		[rule, award, remark].forEach(arr => {
			for (let arrlen = arr.length - 1; arrlen >= 0; arrlen--) {
				if (arr[arrlen].trim() === '') {
					arr.splice(arrlen, 1);
				}
			}
		});

		return {
			gameCode: '',
			title: title,
			date: date,
			qualifications: qualifications,
			rule: rule,
			award: award,
			remark: remark,
			url: url
		};
	} catch (err) {
		console.error(`解析網址失敗 (${url}):`, err.message);
		return null;
	}
}

async function writeFileContent(objArray) {
    let txt = '';

    objArray.forEach(obj => {
        txt += ",{\n";
        ['gameCode', 'title', 'date', 'qualifications', 'rule', 'award', 'remark'].forEach(key => {
            switch (key) {
                case 'gameCode':
                case 'title':
                case 'date':
                case 'qualifications':
                    txt += `${key} : "${obj[key]}",<br/>`;
                    break;
                case 'rule':
                case 'award':
                case 'remark':
                    txt += `${key} : [<br/>`;
                    obj[key].forEach((item) => {
                        txt += `'${item}',<br/>`;
                    });
                    txt += `],<br/>`;
                    break;
            }
        });
        txt += '}<br/>';
    });

	return txt;
}