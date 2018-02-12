var data = {}; // to be sent later to the popup
var ongoing = {}; // maintains list of tab for which scarping is ongoing
ilykei_done = {}; // maintain list of ilykei pages scraped (tab ids)

function send_scraping_start(){
	chrome.runtime.sendMessage({status:"scraping_start_success",receiver:"popup"});
}

function send_scraping_fail(){
	chrome.runtime.sendMessage({status:"scraping_start_fail",receiver:"popup"});
}

function toDataUrl(url, callback) {
    var xhr = new XMLHttpRequest();
	console.log("INSIDE FUNCTION");
    xhr.onload = function() {
        var reader = new FileReader();
        reader.onloadend = function() {
            callback(reader.result);
        }
        reader.readAsDataURL(xhr.response);
    };
    xhr.open('GET', url);
    xhr.responseType = 'blob';
    xhr.send();
}

chrome.runtime.onMessage.addListener(
function(request, sender, sendResponse) {
	if(request.receiver == "background"){
		// if the sender is content_ilykei
		if(request.sender == "content_ilykei"){
			// if the request is to download sidebar or main body documents
			if(request.type.startsWith("download_")){
				console.log(request);
				for(i=0;i<request.download.length;i++){
					if(request.download[i].link.length>3){
						if(request.type=="download_side"){
							actual_link = 'http://ilykei.com'.concat(request.download[i].link);
							chrome.downloads.download({url: actual_link,filename:request.folder.concat("/",request.download[i].name)});
						}
						else if(request.type=="download_main"){
							newArr = request.download[i].link.split("%2F");
							if(request.folder.length>3){
								chrome.downloads.download({url: request.download[i].link,filename:request.folder.concat("/",newArr[newArr.length-1])});
							}else{
								chrome.downloads.download({url: request.download[i].link,filename:newArr[newArr.length-1]});
							}
						}
					}
				}
			}
			// scraping is complete; ask popup to remove the waiting screen now
			else if(request.type == "scraping_done"){
				console.log("content has finished scraping");
				ongoing[sender.tab.id] = 0;
				data[sender.tab.id] = {};
				data[sender.tab.id].tab = sender.tab.id;
				data[sender.tab.id].type = request.type;
				ilykei_done[sender.tab.id] = 1;
				chrome.runtime.sendMessage({status:request.type,receiver:request.destination,data:data});
			}
			sendResponse({received_by: "background events"});
			return;
		}
		if(request.sender == "popup"){
			// if the sender is popup and destination is content, e.g. request to start scraping the webpage
			if(request.destination.startsWith('content')){
				console.log("asking content to start scraping/download");
				chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
						chrome.tabs.sendMessage(tabs[0].id, {action: request.action,data:request}, function(response) {
							var lastError = chrome.runtime.lastError;
							if (lastError) {
								console.log(lastError.message);
								send_scraping_fail();
								// 'Could not establish connection. Receiving end does not exist.'
								return;
							}
							ongoing[tabs[0].id] = 1;
							send_scraping_start();
						});  
				});
				sendResponse({received_by: "scraper"});
			}else{ // popup is asking for scraping status
				if(request.action=="reload"){
					if(String(request.tab.id) in data)
						delete data[request.tab.id];
					if(ilykei_done[request.tab.id]==1)
						ilykei_done[request.tab.id]=0;
					if(request.webpage=="ilykei"){
						request.destination = "content_ilykei";
						chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
							chrome.tabs.sendMessage(tabs[0].id, {action: "clean",data:request}, function(response) {
								var lastError = chrome.runtime.lastError;
								if (lastError) {
									console.log(lastError.message);
									return;
								}
							});  
						});
					}
					sendResponse({received_by: "background_cleaner"});
				}
				if(String(request.tab.id) in data || ilykei_done[request.tab.id]==1){
					console.log("scraping is already done. sending results.");
					chrome.runtime.sendMessage({status:"scraping_done",receiver:"popup",data:data});
				}else if(ongoing[request.tab.id]==1){
					console.log("scraping is ongoing.");
					chrome.runtime.sendMessage({status:"scraping_ongoing",receiver:"popup",data:data});
				}else{
					console.log("scraping needs to be done.");
					chrome.runtime.sendMessage({status:"unknown",receiver:"popup"});			
				}
			}
		}
		// if the sender is content (canvas; for now) and destination is popup, e.g. send scraped data to popup to generate buttons
		else {
			if(request.destination == "popup"){
				console.log("content has finished scraping");
				console.log(request.download);
				chrome.downloads.download({url: request.download,filename:"download.jpg"});				
				toDataUrl(request.download, function(myBase64) {
					console.log("callback");
					//console.log(myBase64); // myBase64 is the base64 string
					var pdf = new jsPDF();
					pdf.addImage(myBase64, 'JPEG',0,0,210,300); //892,600
					pdf.save("download.pdf");
				});
				console.log("DOWNLOAD");
				data[sender.tab.id] = {};
				data[sender.tab.id].tab = sender.tab.id;
				data[sender.tab.id].type = request.type;
				data[sender.tab.id].download = [];
				if(request.type=="file"){
					data[sender.tab.id].download.push({title:request.title,link:request.link});
				}else{
					data[sender.tab.id].download = request.download;
				}
				sendResponse({received_by: "background events"}); // though no response is required to be sent to content script
				console.log("saving scraped data in background");
				console.log(data);
				ongoing[sender.tab.id] = 0;
				chrome.runtime.sendMessage({status:"scraping_done",receiver:"popup",data:data});
			}
		}
	}
	return true;
}
);