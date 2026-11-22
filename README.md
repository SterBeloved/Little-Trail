# Little Trail 🥾🌿
### Your little hiking buddy in Hong Kong.
### 你的香港徒步小夥伴。

Picking a trail is only the beginning. How do you get there? What should you pack? How much time and money will you need?

Little Trail gathers these little preparations into one personalised, bilingual hiking plan. Less time opening tabs, more time looking forward to the trail.

選好路線，只是出發的第一步。怎樣前往起點？需要帶甚麼？時間和預算怎樣安排？

Little Trail 把這些出發前的小事，整理成一份個人化中英雙語徒步計劃。少開幾個分頁，多留一點心情期待出發。

**[Plan your next little adventure ↗](https://sterbeloved.github.io/Little-Trail/)**  
**[開始規劃下一次徒步 ↗](https://sterbeloved.github.io/Little-Trail/)**

No account needed. Open it on your phone and make yourself at home.  
無需註冊或登入，用手機打開就可以開始。

## 🌱 Made from a beginner’s experience
## 從初學者的經驗出發

I fell in love with hiking after moving to Hong Kong. As a beginner, I often spent more energy researching routes, transport, equipment and budgets than I expected. Little Trail grew from a simple wish: to make preparing for a hike feel more manageable.

來到香港後，我才愛上徒步。作為初學者，查找路線、交通、裝備和預算，往往比想像中更花心力。Little Trail 的起點很簡單：讓每次徒步前的準備，都更容易一些。

## 🗺️ A plan that starts with you
## 從你的需要開始

- **A favourite trail, or a fresh suggestion**  
  Enter a preferred route, or leave it open for recommendations. Add special arrangements, such as joining a group with its own coach.  
  填寫心儀路線，或留空讓規劃器提供建議。跟團、有專車等安排，也可以在特別要求中補充。

- **Time for the trail**  
  Available hours cover walking, breaks and photography, including access and exit walks. Vehicle travel time is separate.  
  可用時數包括徒步、休息、拍照，以及接駁起點和離開終點的步行；不包括乘車時間。

- **Experience that matters**  
  Share your last hike, how demanding it felt and your usual exercise habits. Brief preparation suggestions also consider the days remaining before departure.  
  填寫上次徒步經驗、吃力程度及日常運動習慣，規劃器會結合距離出發的日數，提供簡短準備建議。

- **The practical little details**  
  Bring route information, weather, trail notices, reported incidents, outbound transport, food and budgets into one plan, with source links for further reading.  
  把路線、天氣、山徑通告、事故報道、去程交通、飲食和預算整理在一起，附上來源連結，方便繼續查閱。

- **Shopping only when you need it**  
  Add an equipment budget for shopping suggestions. Leave it blank to skip equipment shopping searches.  
  有添置裝備的需要，就填寫裝備預算；留空便跳過裝備購物搜尋。

- **English + Traditional Chinese**  
  English comes first, followed by the corresponding Traditional Chinese.  
  每部分先顯示英文，再附上對應的繁體中文。

Outbound transport includes directions and reference fares. When route timing data is missing, the plan explains what to look up next.  
去程交通提供路線與參考車費；路線時間暫時沒有資料時，計劃會說明下一步可以查找甚麼。

## 📱 A few taps before your next walk
## 用手機，輕鬆準備

Complete three short sections:  
填寫三個簡單部分：

1. **Trip details｜行程資料**
2. **Hiking experience｜徒步經驗**
3. **Budget & equipment｜預算與裝備**

Just having a look? Use **Fill sample** beside the preview button to try the form without typing everything yourself. The preview shows the layout; **Generate plan** creates a plan from your own answers.

想先試玩？點選示例預覽旁的 **Fill sample／填入示例**，就不用逐項輸入。預覽用來查看版面；按下 **Generate plan／生成計劃** 才會根據你的答案正式生成。

The mobile-friendly interface uses soft colours, clear labels and a date picker. You can copy your finished plan, download it as Markdown or print it to PDF.

手機介面採用柔和配色、清晰標籤與日期選擇器。生成後可複製計劃、下載為 Markdown，或列印成 PDF。

## ⚙️ A little teamwork behind the scenes
## 計劃背後的小小分工

**Dify** connects the planning steps. **DeepSeek** analyses requirements, compares routes and writes the final plan. **Tavily** retrieves supporting information, while **Hong Kong Observatory open data** supplies forecasts and current warnings.

**Dify** 串連各個規劃步驟，**DeepSeek** 分析需求、比較路線並整理最終計劃，**Tavily** 搜尋相關資料，**香港天文台開放數據**則提供天氣預報與當前警告。

The frontend runs on **GitHub Pages** and connects to Dify through a **Cloudflare Worker**. API keys stay on the server. Independent searches run in parallel, simple formatting uses code, and equipment shopping retrieval is skipped when no budget is entered.

前端部署於 **GitHub Pages**，經 **Cloudflare Worker** 連接 Dify，API 金鑰保存在伺服器端。獨立搜尋會並行執行，簡單格式整理交由程式處理；未填裝備預算時，便跳過購物資料查詢。

Later test runs took around **14–20 seconds**, compared with approximately **214 seconds** in an early run. These runs used different inputs; waiting time varies with the request and services.

後期測試約需 **14–20 秒**，早期一次測試則約需 **214 秒**。測試輸入有所不同，實際等待時間會隨需求與服務狀況變化。

## 💌 Help this little trail grow
## 一起讓 Little Trail 更好用

At the end of your generated plan, **Share your feedback** opens a small feedback form. Tell me what was helpful, confusing or missing.

生成計劃的最後設有 **Share your feedback／告訴我你的使用感受**。哪裡好用、哪裡看不懂，或少了甚麼，都歡迎告訴我。

Anonymous usage statistics record timing, completion status and available token counts to help improve performance. The statistics table does not store your form answers or generated plan. Feedback is collected separately through Formspree.

匿名使用統計記錄用時、完成狀態及可取得的 token 用量，幫助改善效能。統計表不儲存填寫內容或生成計劃；意見則透過 Formspree 另外收集。

The footer’s **Admin／管理入口** is the owner’s password-protected statistics page. Friends can use the planner without logging in.

頁腳的 **Admin／管理入口** 是供管理者查看統計的密碼保護頁面。朋友使用規劃器無需登入。

## 🌦️ One last look before you go
## 出發前，再看一眼

Recheck the weather, trail notices and transport services before leaving. Fares and shopping prices are references, and weather information is a forecast. Use your preferred map tool for navigation, then enjoy your little adventure.

出發前，再看看最新天氣、山徑通告與交通安排。車費及商品價格僅供參考，天氣資訊屬預測。導航交給你慣用的地圖工具，然後好好享受這趟小旅程。

---

Created for **AIH5571 Introduction to Generative AI and Its Applications**, and continuing to grow through real hikes, testing and feedback.  
為 **AIH5571 Introduction to Generative AI and Its Applications** 課程製作，也會隨著實際徒步、測試與回饋慢慢成長。
