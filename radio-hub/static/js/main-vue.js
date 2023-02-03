// 定义静态文件目录url
let static_url = document.currentScript.src.split('/js/')[0];
// let wndt_hls_url = "https://lf3-cdn-tos.bytecdntp.com/cdn/expire-1-M/hls.js/1.1.5/hls.min.js";

// 时间戳
let timestamp = Date.parse(new Date()) / 1000;

let is_mobile = wnd_is_mobile();

// Token
axios.defaults.headers["Authorization"] = "Bearer " + getCookie("wnd_token");

// js 获取cookie
function setCookie(name, value, daysToLive) {
	// Encode value in order to escape semicolons, commas, and whitespace
	var cookie = name + "=" + encodeURIComponent(value);

	if (typeof daysToLive === "number") {
		/* Sets the max-age attribute so that the cookie expires
		after the specified number of days */
		cookie += "; max-age=" + (daysToLive * 24 * 60 * 60);

		document.cookie = cookie;
	}
}

// js 获取cookie
function getCookie(name) {
	// Split cookie string and get all individual name=value pairs in an array
	var cookieArr = document.cookie.split(";");

	// Loop through the array elements
	for (var i = 0; i < cookieArr.length; i++) {
		var cookiePair = cookieArr[i].split("=");

		/* Removing whitespace at the beginning of the cookie name
		and compare it with the given string */
		if (name == cookiePair[0].trim()) {
			// Decode the cookie value and return
			return decodeURIComponent(cookiePair[1]);
		}
	}

	// Return null if not found
	return "";
}

/**
 * 获取元素外缘距离窗口的距离
 **/
function wnd_get_rect(el) {
	let rect = el.getBoundingClientRect();
	let de = document.documentElement;

	return {
		top: rect.top,
		right: de.clientWidth - rect.right,
		bottom: de.clientHeight - rect.bottom,
		left: rect.left
	}
}

/**
 * 保持元素在底部
 **/
function wndt_keep_bottom(selector, offset) {
	let el = document.querySelector(selector);
	if (el.length <= 0) {
		return false;
	}

	let rect = wnd_get_rect(el);
	if (rect.bottom > 0 && (rect.bottom - offset) > 0) {
		el.style["margin-top"] = (rect.bottom - offset) + "px";
	}
}

/**
 * 播放器
 **/
function wndt_player(container, post_id, is_home) {
	//首页调用的情况，统计浏览
	if (is_home) {
		wnd_update_views(post_id, 3600 * 6);
	}

	if ('function' != typeof _wndt_player) {
		let url = static_url + '/js/player.min.js?ver=' + wndt.ver;
		wnd_load_script(url, function() {
			_wndt_player(container, post_id, is_home);
		});
	} else {
		_wndt_player(container, post_id, is_home);
	}
}

/**
 *@since 2019.07.02 用户浏览记录播放
 *@param container 播放记录html需要嵌入的容器
 *@param palyer_container 播放器需要嵌入的容器
 */
function wndt_last_views_shortcut(container, palyer_container) {
	let wndt_stations = localStorage.getItem("wndt_stations") ? JSON.parse(localStorage.getItem("wndt_stations")) : false;
	if (!wndt_stations) {
		return;
	}

	/**
	 *@since 2019.07.15 按时间排序
	 */
	wndt_stations.sort(function(a, b) {
		return a.time < b.time;
	});

	wnd_prepend(container, '<h3 class="center-title"><span class="h-span">Last</span></h3><ul class="columns is-multiline is-tablet"></ul>');
	let el = '';
	for (let i = 0; i < 3; i++) {
		if (typeof wndt_stations[i] == "undefined") {
			break;
		}
		let station = wndt_stations[i].station;
		el += `<li class="column has-text-centered"><a onclick="wndt_player('${palyer_container}', ${station.ID}, true)">${station.title}</a></li>`;
	}
	wnd_append(container + " ul.columns", el);
}

// 切换 tab
function wndt_switch_tab(e, ul) {
	let li = e.target.closest('li');
	let index = Array.from(ul.children).indexOf(li);
	let target = document.querySelector(ul.dataset.for);
	if (!target) {
		return;
	}

	for (let i = 0, j = target.children.length; i < j; i++) {
		let el = target.children[i];
		let current = ul.children[i];
		if (i == index) {
			el.classList.remove("is-hidden");
			current.classList.add("is-active");
		} else {
			el.classList.add("is-hidden");
			current.classList.remove("is-active");
		}
	}
}

/**
 * 用户主动关闭提示通知【不再提示】
 * 记录时间戳
 */
 function wndt_close_notification() {
    wnd_reset_modal();

    localStorage.setItem("notification", timestamp);
}

/**
 * 获取用户最后主动关闭通知【不再提示】的时间戳
 */
 function wndt_get_user_last_notification_time() {
   return localStorage.getItem("notification");
}

/**
 *监听点击事件
 */
document.addEventListener('click', function(e) {
	// switch tab
	let ul = e.target.closest('ul');
	if (ul && ul.classList.contains("switch-tab")) {
		return wndt_switch_tab(e, ul);
	}
});