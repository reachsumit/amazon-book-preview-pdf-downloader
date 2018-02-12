var currentTab;
var global_button_links;
var webpage;
var singleLink;
var modules;

// TODO: Protect against load/reload
//https://stackoverflow.com/questions/23895377/sending-message-from-a-background-script-to-a-content-script-then-to-a-injected/23895822#23895822

function startProcess() {
	console.log("sending request to background")
	var msg = {};
	msg.sender = "popup";
	msg.receiver = "background";
	msg.destination = "content_amazon";	// it will go to content via events
	msg.action = "scrape";
	msg.tab = currentTab;

	chrome.runtime.sendMessage(msg, function(response) {
		console.log(response.received_by.concat(" heard me."));
	});
}

document.getElementById('startProcess').onclick = startProcess;

$(document).ready(function(){
	$("#waiting").hide();
	String.prototype.trunc = String.prototype.trunc ||
      function(n){
          return (this.length > n) ? this.substr(0, n-1) + '&hellip;' : this;
		};
	chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
	  currentTab = tabs[0]; // there will be only one in this array
	  tab_id = currentTab.id;	  // also has properties like currentTab.id
	  tab_url = currentTab.url;
	  indicate_start(tab_id,tab_url);
	});
});

function ask_for_status(tab_id){
	var msg = {};
	msg.sender = "popup";
	msg.receiver = "background";
	msg.destination = "background";
	msg.action = "check_status";
	msg.tab = currentTab;
	chrome.runtime.sendMessage(msg);
}

function indicate_start(tab_id,tab_url){
	console.log(tab_id,tab_url);
	startProcess();
	return;
	if ((tab_url.search(/canvas.uchicago.edu/) != -1)&&((tab_url.search(/modules/) != -1) || (tab_url.search(/files/)!=-1))){
		ask_for_status(tab_id);
		webpage = "canvas";
	}
	else if(tab_url.search(/ilykei.com/) != -1){
		if(tab_url.search(/lectures/) == -1){
			if(tab_url.search(/lecture/) != -1){
				ask_for_status(tab_id);
				webpage = "ilykei";
			}else{
				document.getElementById('pText').innerHTML = "Sorry! This webpage is currently not supported :(";
				$("#startProcess").hide();
				$("#notSupported").show();
			}
		}else{
			document.getElementById('pText').innerHTML = "Sorry! This webpage is currently not supported :(";
			$("#startProcess").hide();
			$("#notSupported").show();
		}
	}else{
		document.getElementById('pText').innerHTML = "Sorry! This webpage is currently not supported :(";
		$("#startProcess").hide();
		$("#notSupported").show();
	}
}

function make_popup_busy(){
	$("#startProcess").hide();
	$("#waiting").show();
	$("#pText").text("Please wait! This might take upto a minute.");
	//$("#p2Text").text("(Do not close this popup window!)");
}

function make_popup_free(){
	$("#waiting").hide();
	$("#pText").text("Your downloads are ready! :)");
	$("#startProcess").hide();
	$(".close").show();
	$(".close").click(function() {
		window.close();
	});
}
function request_download(down_id){
	var dlinks = [];
	var dnames = [];
	for(i=0;i<global_button_links[down_id].length;i++){
		dlinks.push(global_button_links[down_id][i].link_next.download_link);
		dnames.push(global_button_links[down_id][i].link_next.download_filename);
	}
	folder=modules[down_id].replace(/[^a-z0-9.(),';{} +&^%\[\]$#@!~`-]/gi, '_');
	for(i=0;i<dlinks.length;i++){
		actual_link = 'https://canvas.uchicago.edu'.concat(dlinks[i]);
		chrome.downloads.download({url: actual_link,filename:folder.concat("/",dnames[i])});
	}
}

function singleLink_download(down_id){
	actual_link = singleLink[0];
	chrome.downloads.download({url: actual_link});
}

function dummy(){
	chrome.downloads.download({url: "http://unec.edu.az/application/uploads/2014/12/pdf-sample.pdf"});
}

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
	  // message is from background to popup
	  if(request.receiver=="popup"){
			//if(request.sender==""){
			console.log(request);
			if(request.status=="scraping_done"){
				$("#startProcess").hide();
				var button_titles = [];
				var button_links = [];
				make_popup_free();
				if(request.data[currentTab.id].type == "batch"){				
					Object.entries(request.data[currentTab.id].download).forEach(([key, val]) => {
						if(val.topics.length>0){
								button_titles.push(key);
								button_links.push(val.topics);
						}
					});
					modules = button_titles;
					global_button_links = button_links;
					for(i=0;i<button_titles.length;i++){
						$('body').append('<div style="margin: auto;width: 70%;"><button type="button" id="'+String(i)+'" class="btn btn-info" style="margin-top:10px;">'+button_titles[i].trunc(22)+'</button></div>');
					}
					$("button").click(function() {
						request_download(this.id);
					});
					$('body').append('<div style="margin: auto;width: 15%;"><a href="#" class="reload">Reload</a></div>');
					$(".reload").click(function() {
						clean_tab_entry();
					});
				}else if(request.data[currentTab.id].type == "file"){
					button_titles.push(request.data[currentTab.id].download[0].title);
					button_links.push(request.data[currentTab.id].download[0].link);
					
					singleLink = button_links;
					for(i=0;i<button_titles.length;i++){
						$('body').append('<div style="margin: auto;width: 70%;"><button type="button" id="'+String(i)+'" class="btn btn-info" style="margin-top:10px;">'+button_titles[i].trunc(22)+'</button></div>');
					}
					$("button").click(function() {
						singleLink_download(this.id);
					});
					$('body').append('<div style="margin: auto;width: 15%;"><a href="#" class="reload">Reload</a></div>');
					$(".reload").click(function() {
						clean_tab_entry();
					});
					
				}else if(request.data[currentTab.id].type == "scraping_done"){
					// show ilykei instructions here
					$("#p2Text").text("(Close this popup and use the download links on the website as shown below.)");
					$(".close").show();
					$(".close").click(function() {
						window.close();
					});
					$("#ilykei1").show();
					$("#ilykei2").show();
					$('body').append('<div style="margin: auto;width: 15%;"><a href="#" class="reload">Reload</a></div>');
					$(".reload").click(function() {
						clean_tab_entry();
					});
				}
			}else if(request.status=="unknown"){
				document.getElementById('pText').innerHTML = "Hello! Please use the process button to parse this page.";
				$("#startProcess").show();
			}
			else if(request.status=="scraping_start_success" || request.status == "scraping_ongoing"){
				make_popup_busy();
			}
			else if(request.status=="scraping_start_fail"){
				$("#startProcess").hide();
				document.getElementById('pText').innerHTML = "Sorry! Chrome background process is dead. :(";
				$("#p2Text").text("(Please try refreshing this page.)");
				$(".close").show();
					$(".close").click(function() {
						window.close();
				});
			}
	    }
});

function clean_tab_entry(){
	var msg = {};
	msg.sender = "popup";
	msg.receiver = "background";
	msg.destination = "background"
	msg.action = "reload";
	msg.webpage = webpage;
	msg.tab = currentTab;

	chrome.runtime.sendMessage(msg, function(response) {
		$( "body" ).empty();
		window.close();
		//$("#startProcess").show();
		//document.getElementById('pText').innerHTML = "Hello! Please use the process button to parse this page.";
		console.log(response.received_by.concat(" heard me."));
	});
}