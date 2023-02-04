/*
 * strean 格式：
 * [
 * 	{"type":"m3u8", "url":"xxxx"},
 * 	{"type":"mp3", "url":"xxxx"},
 * ]
 * 
 */
function _wndt_player(container, post_id, is_home) {
	let app_option = {
		template: `
<div id="ajax-player">
	<div id="player-title" v-if="is_home">
		<h3 class="center-title is-hidden-mobile"><span class="h-span">Last FM</span></h3>
		<h1 class="title is-size-5">
			<span class="icon"><i class="fa fa-headphones-alt"></i></span>&nbsp;<a :href="station.link">{{station.title}}</a>
		</h1>
	</div>
	<div v-show="'hls'==player_type" id="hls-player"></div>
	<div v-show="'ali'==player_type" id="ali-player"></div>
	<div v-show="'h5'==player_type" id="h5-player"></div>
	<div v-show="'flash'==player_type" id="flash-player"></div>
	<div id="ajax-player-bar" class="has-text-centere content">
			<div class="tabs is-fullwidth is-hidden-desktop is-hidden-tablet" :class="'h5' != player_type ? 'is-hidden' : ''">
				<ul><li><a></a></li><li class="is-active"><a></a></li><li><a></a></li></ul>
			</div>
		<div id="ajax-player-meta">
			<span class="icon"><i class="fas fa-comment-dots"></i></span><a class="smooth" :href="station.link + '#comments'">Comments</a>&nbsp;
			&nbsp;-&nbsp;<span class="icon"><i class="fas fa-satellite-dish"></i></span>
			<a v-for="(stream, index) in station.stream" :class="stream == current_stream ? 'is-active' : ''" @click="build_player(stream, index)">{{stream.type}}</a>
			<span v-html="station.message"></span>
		</div>
		<div v-show="station_notice.content || site_notice.content" class="notification is-light" :class="station_notice.class || site_notice.class" v-html="station_notice.content || site_notice.content"></div>
		<div class="wndt-ads" v-show="is_home && !is_vip"></div>
	</div>
</div>`,
		data() {
			return {
				station: {},
				player_type: "",
				current_stream: {},
				local_storage: [],
				local_storage_index: 0,
				is_new_station: true,
				is_home: is_home,
				is_vip: wndt.is_vip,
				station_notice: {
					"class": "",
					"content": ""
				},
				site_notice: wndt.site_notice,
			}
		},
		methods: {
			build_player: function (stream, index) {
				this.current_stream = stream;
				this.station.default_stream_index = index;
				this.player_type = this.choose_player(stream);

				// 混合内容需要在 http 子播放器播放
				if ("new_window" == this.player_type) {
					this.station_notice = {
						"class": "is-warning",
						"content": `<p>当前播放受限，请在点击新窗口播放，或选择其他线路：</p><p><a class="button is-danger is-small is-outlined" href="http://player.tingfm.com/?id=${post_id}">新窗口播放</a></p>`,
					}
					wnd_inner_html("#h5-player", "");
					wnd_inner_html("#hls-player", "");

					// 此处保存用户播放器类型选择
					this.save_to_local();
					return;
				}

				// 重置提示
				this.station_notice = {
					"class": "",
					"content": ""
				};

				let volume = parseFloat(localStorage.getItem("wndt_volume") ? localStorage.getItem("wndt_volume") : "0.5");
				volume = is_mobile ? 1 : volume;
				let autoplay = true;
				let url = stream.url;

				// 清除当前播放器：需要保留 audio_player 否则切换播放器后底部 vue 按钮实例将无法重新监听
				let audio_player = document.querySelector("#audio-player");
				if (audio_player) {
					audio_player.pause();
				}

				wnd_inner_html("#flash-player", "");
				wnd_inner_html("#hls-player", "");
				wnd_inner_html("#ali-player", "");

				if ("hls" == this.player_type) {
					this.build_hls_player(url, volume, autoplay);
				} else if ("ali" == this.player_type) {
					this.build_aliplayer(url, volume, autoplay);
				} else if ("flash" == this.player_type) {
					this.build_flash_player(url, volume, autoplay);
					if (!has_flash()) {
						this.station_notice = {
							"class": "is-warning",
							"content": `<p>当前线路需<b>国产浏览器</b>并：<a href="https://www.flash.cn"><b>安装Flash</b></a>，或在：<a onclick="wnd_ajax_modal('wndt_qrcode_modal', {post_id : ${post_id}})"><b>手机收听</b></a></p>`
						};
					}
				} else {
					this.build_h5_player(url, volume, autoplay);
				}

				// 此处保存用户播放器类型选择
				this.save_to_local();

				// 展示广告
				this.show_ads();
			},

			// 添加广告 音频自动播放会持续加载下一集，不可重复加载广告
			show_ads: function () {
				if (!is_home || wndt.is_vip) {
					return;
				}
				wnd_inner_html(container + " .wndt-ads", `
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3030540414938051"
     crossorigin="anonymous"><\/script>
	<!-- 自适应广告 -->
	<ins class="adsbygoogle"
	     style="display:block"
	     data-ad-client="ca-pub-3030540414938051"
	     data-ad-slot="2731914802"
	     data-ad-format="auto"
	     data-full-width-responsive="true"><\/ins>
<script>
     (adsbygoogle = window.adsbygoogle || []).push({});
<\/script>`);

			},

			// 广告屏蔽检测
			check_adblock: function () {
				if (wndt.is_vip || wnd_is_spider()) {
					return false;
				}

				// adblock 直接 js 拦截检测：仅针对老用户
				if ("undefined" == typeof can_run_ads) {
					let block_time = localStorage.getItem("adblocked");
					if (!block_time) {
						localStorage.setItem("adblocked", timestamp);
						return false;
					}

					if (timestamp - block_time > 3600) {
						return true;
					}
				}

				return false;
			},

			// 返回：h5、hls、flash、new_window
			choose_player: function (stream) {
				// 未知格式
				if ("unknown" == stream.type) {
					return "ali";
				}

				// YT 默认支持
				let m3u8_support_hls = ("yes" == (this.station.meta.m3u8_support_hls || false) || this.station.meta.stream_ytid) ? true : false;
				let mixed_content = ('https:' == location.protocol && !is_https(stream.url));

				// 移动端
				if (is_mobile) {
					// 百度 App、微信、QQ浏览器
					let userAgent = navigator.userAgent || "";
					if (userAgent.match(/(Baiduboxapp|micromessenger|MQQBrowser)/i)) {
						return "h5";
					}

					// 浏览器不支持 H5 播放混合内容
					let is_ios = userAgent.match(/(iPhone|iPad)/i);
					if (mixed_content && (get_chrome_version() >= 80 || is_ios)) {
						return "new_window";
					}

					// 苹果 iOS 设备
					if (is_ios) {
						return "h5";
					}

					if ("m3u8" == stream.type && m3u8_support_hls && "radio" == this.station.type) {
						return "hls";
					}

					return "h5";
				}

				// 非 m3u8
				if ("m3u8" != stream.type) {
					// 浏览器不支持 H5 播放混合内容
					if (mixed_content && get_chrome_version() >= 80 && !is_wechat()) {
						return "new_window";
					} else {
						return "h5";
					}
				}

				// 支持跨域的 m3u8
				if (m3u8_support_hls) {
					return mixed_content ? "new_window" : "hls";
				}

				// flash
				return "flash";
			},

			build_hls_player: function (url, volume, autoplay = false) {
				if ("undefined" == typeof chplayer) {
					let js_url = static_url + "/chplayer/chplayer.min.js?ver=" + wndt.ver;
					wnd_load_script(js_url, () => {
						build_player();
					});
				} else {
					build_player();
				}

				function build_player() {
					ch_videoObject = {
						container: "#hls-player",
						// variable: "hls_player",
						volume: volume,
						autoplay: autoplay,
						loop: false,
						live: true,
						loaded: "chLoadedHandler", //当播放器加载后执行的函数
						html5m3u8: true,
						video: url,
					};

					// 定义全局变量，不得添加 var, let 等关键词，需与外部监听函数变量保持一致
					ch_player = new chplayer(ch_videoObject);
				}
			},

			build_h5_player: function (url, volume, autoplay = false) {
				let autoplay_attr = autoplay ? "autoplay" : "";
				let el = '';
				if ('radio' == this.station.type) {
					el = `<audio id="audio-player" class="h5-player-el is-hidden-mobile" src="${url}" controls ${autoplay_attr}/>`;
				} else {
					el = `<video id="video-player" class="h5-player-el" src="${url}" controls ${autoplay_attr}/>`;
				}

				// 仅在首次创建：切换后仅更新 url 以便于在切换播放器后，保持底部按钮 vue 实例对播放器的监听
				if ("undefined" == typeof audio_player) {
					wnd_inner_html("#h5-player", el);
					audio_player = document.querySelector(".h5-player-el");
					h5_player_monitor(audio_player);
				} else {
					audio_player.src = url;
				}

				// 非手机端：音量同步 localstorage
				if (!is_mobile) {
					audio_player.volume = volume;
					audio_player.onvolumechange = () => {
						localStorage.setItem("wndt_volume", audio_player.volume);
					}
				}
			},

			build_flash_player: function (url, volume, autoplay = false) {
				if ("undefined" == typeof ckplayer) {
					let js_url = static_url + "/ckplayer/ckplayer.min.js?ver=" + wndt.ver;
					wnd_load_script(js_url, () => {
						build_player();
					});
				} else {
					build_player();
				}

				function build_player() {
					let videoObject = {
						container: "#flash-player", //容器的ID
						variable: "ck_player", //播放函数名称
						loaded: "ckLoadedHandler", //加载成功 启用ckLoadedHandler监听函数
						live: true,
						volume: volume,
						autoplay: autoplay,
						video: url,
					};
					loading_ps = "bottom"; //ckplayer loading图标位置
					ck_player = new ckplayer(videoObject);
				}
			},

			/**
			 * @link https://player.alicdn.com/aliplayer/index.html
			 * 阿里播放器
			 * 播放器flash模式也不支持央广，所以无法完全替换现有播放器
			 **/
			build_aliplayer: function (url, volume, autoplay = false) {
				if ("undefined" == typeof Aliplayer) {
					wnd_load_style("https://g.alicdn.com/de/prismplayer/2.9.17/skins/default/aliplayer-min.css");
					let js_url = "https://g.alicdn.com/de/prismplayer/2.9.17/aliplayer-min.js";
					wnd_load_script(js_url, () => {
						build_player();
					});
				} else {
					build_player();
				}

				function build_player() {
					let player = new Aliplayer({
						"id": "ali-player",
						"source": url,
						"width": "100%",
						"height": "60px",
						"autoplay": autoplay,
						"isLive": true,
						"rePlay": false,
						"playsinline": true,
						"preload": true,
						"controlBarVisibility": "always",
						"useH5Prism": true,
						"skinLayout": [{
							"name": "bigPlayButton",
							"align": "blabs",
							"x": '50%',
							"y": 0
						}, {
							"name": "H5Loading",
							"align": "cc"
						}, {
							"name": "controlBar",
							"align": "blabs",
							"x": 0,
							"y": 0,
							"children": [{
								"name": "liveDisplay",
								"align": "tlabs",
								"x": 15,
								"y": 6
							}, {
								"name": "volume",
								"align": "tr",
								"x": 5,
								"y": 10
							}]
						}]
					}, function (player) {
						player.setVolume(volume);
						document.onkeydown = function (e) {
							let keyNum = window.event ? e.keyCode : e.which;
							//判断如果用户按下了空格键(keycode=32)，  
							if (keyNum == 32) {
								if ("playing" == player.getStatus()) {
									player.pause();
								} else {
									player.play();
								}
							}
						}
					});
				}
			},

			// 获取电台 API
			get_remote_station: function () {
				if (typeof token == "undefined") {
					token = wndt.token;
				}
				let data = axios({
					method: "GET",
					url: wnd_query_api + "/wndt_post",
					params: {
						"post_id": post_id,
						"in_web": true,
					},
					headers: {
						"Stream-Token": token,
					},
				}).then(res => {
					if (res.data.status <= 0) {
						this.station_notice = {
							"class": "is-warning",
							"content": res.data.msg,
						}
						return false;
					}
					return res.data.data;
				}).catch(function (error) { // 请求失败处理
					console.log(error);
				});

				return data;
			},

			// 取出本地存储电台信息并转为对象 @2019.07.01
			get_local_station: async function () {
				let station_info;
				this.local_storage = localStorage.getItem("wndt_stations") ? JSON.parse(localStorage.getItem("wndt_stations")) : [];
				for (let i = 0; i < this.local_storage.length; i++) {
					if (this.local_storage[i].station.ID == post_id) {
						station_info = this.local_storage[i];
						// yt 需更新密匙
						if (station_info.station.meta.stream_ytid) {
							let remote_info = await this.get_remote_station();
							if (remote_info) {
								station_info.station = Object.assign(station_info.station, remote_info);
							}
						}

						this.is_new_station = false;
						this.local_storage_index = i;
						break;
					}
				}

				if (this.is_new_station) {
					return false;
				}

				/**
				 *对比修改时间：内页对比当前post 修改时间，首页对比最近一个radio post修改时间
				 *或者本地存储数据时间早于强制刷新时间
				 */
				if (wndt.modified > station_info.time || wndt.force_refresh > station_info.time) {
					return false;
				}

				return station_info.station;
			},

			// 写入或更新本地数据
			save_to_local: function () {
				if (this.is_new_station) {
					let new_station = {
						"station": this.station,
						"time": timestamp,
					};
					this.local_storage.unshift(new_station);
				} else {
					let i = this.local_storage_index;
					this.local_storage[i].station = this.station;
					this.local_storage[i].time = timestamp;
				}

				// 底部溢出记录
				if (this.local_storage.length > wndt.local_storage_limit) {
					this.local_storage.length = wndt.local_storage_limit
				}

				// 写入本地存储
				localStorage.setItem("wndt_stations", JSON.stringify(this.local_storage));
			}
		},

		created: function () {

		},

		mounted: async function () {
			// 广告屏蔽检测
			if (this.check_adblock()) {
				wnd_inner_html(container, wndt.fuck_adblock);
				return false;
			}

			//读取电台 涉及 promise 必须合并结果而不能直接赋值
			let local_station = await this.get_local_station();
			let station = false;
			if (local_station) {
				station = local_station;
			} else {
				station = await this.get_remote_station()
			}

			if (!station) {
				return false;
			}
			station = Object.assign(this.station, station);
			this.station = station;

			// 构造播放器
			let stream_index = this.station.default_stream_index || 0;
			this.build_player(this.station.stream[stream_index], stream_index);

			// 写入 Last
			localStorage.setItem("wndt_last", JSON.stringify(this.station));
		},
	};

	let parent = document.querySelector(container);
	wnd_inner_html(parent, '<div class="vue-app"></div>');
	Vue.createApp(app_option).mount(container + ' .vue-app');

	// ################################# 播放器
	/**
	 *检测flash
	 */
	function has_flash() {
		var flashObj;
		if (typeof window.ActiveXObject != "undefined") {
			flashObj = new ActiveXObject("ShockwaveFlash.ShockwaveFlash");
		} else {
			flashObj = navigator.plugins["Shockwave Flash"];
		}
		return flashObj ? true : false;
	}

	// 获取chrome版本
	function get_chrome_version() {
		var raw = navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./);
		return raw ? parseInt(raw[2], 10) : false;
	}

	// 判断是否为微信浏览器
	function is_wechat() {
		let ua = navigator.userAgent.toLowerCase();
		if (ua.match(/MicroMessenger/i) == "micromessenger") {
			return true;
		}
	}

	// 检测是否为Https
	function is_https(url) {
		if (!url || url.indexOf("http") == -1) {
			return false;
		}

		if ("https" == (url.split(":")[0])) {
			return true;
		} else {
			return false;
		}
	}

	/***
	 *@since 2019.07.14
	 *监听audio播放器状态
	 */
	function h5_player_monitor(audio_player) {
		let is_playing = false;
		let current_time = 0;

		let app_option = {
			data() {
				return {
					icon: `<i class="fas fa-play"></i>`,
					add_class: "",
				}
			},
			methods: {
				play: function () {
					// 清除潜在的播放器，防止多个播放器同时播放
					wnd_inner_html("#flash-player", "");
					wnd_inner_html("#hls-player", "");
					wnd_inner_html("#ali-player", "");

					if (audio_player.paused) {
						audio_player.play();
						this.icon = "";
						this.add_class = "playing";
					} else {
						audio_player.pause();
						this.icon = "";
						this.add_class = "";
					}
				}
			},
			created: function () {
				// 播放时间改变时
				audio_player.ontimeupdate = () => {
					// 当已开始播放，中途缓存时，此处需要延迟一点时间操作，否则缓存样式会被覆盖
					if (audio_player.currentTime > 1 && audio_player.currentTime <= current_time + 0.5) {
						return;
					}

					if (!is_playing) {
						is_playing = true;
						this.icon = "";
						this.add_class = "playing";
					}
				};

				// 缓冲
				audio_player.onloadstart = audio_player.onloadeddata = audio_player.onloadedmetadata = audio_player.onwaiting = () => {
					is_playing = false;
					this.icon = `<a class="button is-danger is-loading"></a>`;
					this.add_class = "";
				};

				// 暂停
				audio_player.onpause = audio_player.oncanplay = () => {
					is_playing = false;
					this.icon = `<i class="fas fa-play"></i>`;
					this.add_class = "";
				};

				// 播放出错
				audio_player.onerror = () => {
					is_playing = false;
					this.icon = `<i class="fas fa-exclamation-triangle"></i>`;
					this.add_class = "";
				};
			},
		};

		Vue.createApp(app_option).mount("#footer-app");
	}
}

// ########################################################## 播放器监听 Begin
// Ckplayer监听
function ckLoadedHandler() {
	ck_player.addListener("volume", ckVolumeChangeHandler);
	ck_player.addListener("error", ckErrorHandler); //监听错误
}

// ckplayer 音量调节
function ckVolumeChangeHandler(vol) {
	localStorage.setItem("wndt_volume", vol);
}

// ckplayer 播放出错
function ckErrorHandler() {
	console.log("播放错误");
	// wnd_alert_msg("播放错误！", 1);
}

// CHPlayer监听
function chLoadedHandler() {
	ch_player.addListener("volumechange", chVolumeChangeHandler); //监听音量改变
	ch_player.addListener("error", chErrorHandler); //监听视频加载出错
	ch_player.addListener('loadedmetadata', chloadedMetaHandler); //监听元数据
}

// chplayer 音量调节
function chVolumeChangeHandler() {
	localStorage.setItem("wndt_volume", ch_player.volume);
}

// chplayer 播放出错
function chErrorHandler() {
	console.log("播放错误");
	// wnd_alert_msg("播放错误！", 1);
}

// 浏览器阻止导致不能自动播放的情况
function chloadedMetaHandler() {
	let ch_videoObject = ch_player.vars;
	let metaData = ch_player.getMetaDate();
	if (true === ch_videoObject.autoplay && metaData['paused']) {
		ch_videoObject.autoplay = false;
		ch_player.newVideo(ch_videoObject);
		ch_player.loadingStart(false);
	}
}
// ########################################################## 播放器监听 End