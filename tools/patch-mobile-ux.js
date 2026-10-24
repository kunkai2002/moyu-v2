const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'ui', 'm', 'm.js');
let s = fs.readFileSync(p, 'utf8');

// 友善錯誤 + 重試按鈕
s = s.replace(
  `    } catch (e) {
      state.textContent = '讀取失敗：' + e.message;
    }`,
  `    } catch (e) {
      state.innerHTML = '連不上本機服務（請確認電腦端的魔芋一夏有開著）'
        + '<button id="mRetry" style="margin-left:8px;color:#ff6b35">重試</button>';
      grid.innerHTML = '';
      document.getElementById('mRetry')?.addEventListener('click', loadShelf);
    }`,
);

// 開書失敗也給人話
s = s.replace(
  `    } catch (e) {
      $('#rBody').innerHTML = '<p>' + esc(e.message) + '</p>';
    }`,
  `    } catch (e) {
      $('#rBody').innerHTML = '<p style="color:#999">這本書打不開：' + esc(e.message) + '</p>';
    }`,
);

fs.writeFileSync(p, s, 'utf8');
console.log('+ 手機版錯誤提示改為人話 + 重試');
