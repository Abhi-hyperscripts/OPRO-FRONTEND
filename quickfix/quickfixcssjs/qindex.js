const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const parameterValue = urlParams.get('xid');
var AllProperties = null;
var userEmail = null;
function initializeSignalR(emaiID) {
    var hubconsstring = applicationdomain + 'applicationhub?token=&appcode=dailyjobtracker&param=' + emaiID;

    const iconnection = new signalR.HubConnectionBuilder()
        .withUrl(hubconsstring)
        .withAutomaticReconnect({
            nextRetryDelayInMilliseconds: retryContext => {
                if (retryContext.elapsedMilliseconds < 60000) {
                    // Wait 2 seconds before the next reconnect attempt
                    return 2000;
                }
            }
        })
        .configureLogging(signalR.LogLevel.Information)
        .build();

    iconnection.start().then(function () {
        console.log("connected");
        $('#avatar-status').removeClass('avatar-offline');
        $('#avatar-status-dd').removeClass('avatar-offline');

        $('#avatar-status').addClass('avatar-online');
        $('#avatar-status-dd').addClass('avatar-online');

        iconnection.invoke('getConnectionId')
            .then(function (connectionId) {
                sessionStorage.setItem('conectionId', connectionId);
                //document.getElementById('SIGNALR_ID').value = connectionId;
                // Send the connectionId to controller
            }).catch(err => console.error(err.toString()));
    }).catch(err => console.error('Connection failed: ', err.toString()));

    iconnection.on("TriggerAction", function (ActionName, ActionMessage) {
        // Handle the TriggerAction event
        // console.log(`Action: ${ActionName}, Message: ${ActionMessage}`);

        if (ActionName === 'JOBCREATED') {
            $('#top-notification-bell').html(`<span class="badge bg-danger rounded-pill badge-notifications">${ActionMessage}</span>`);
            $('#openjobscount').text(ActionMessage);
        }
        else if (ActionName === 'JOBASSIGNED') {
            playMusic();
        }
    });
}
function GetSignalRclientID() {
    return iconnection.connection.connectionId;
}

$(document).ready(function () {
    
    UserObject = GetStoredUserData();
    if (UserObject != null){
        userName = UserObject.name;
        userEmail = UserObject.username;
        userDesignation = UserObject.desg;
        CurrentProperty = null;
        UserRoles = UserObject.role;
        initializeSignalR(userEmail);
        $('#UserName_Name').text(UserObject.name);
        $('#is-designation').text(userDesignation);
        GetPropertyList(UserRoles,UserObject.prop);
            
  
    }
    else{
        LogoutUser();
    }
});

function GetPropertyList(uroles, propid){
    var ep = applicationdomain + 'api/dailyjob/getallproperty';
    var jwt = GetStoredJwt();

    $.ajax({
        url: ep,
        type: 'GET',
        dataType: 'json',
        processData: false,
        contentType: false,
        headers: {
            "Authorization": "Bearer " + jwt
        },
        success: function (Response) {
            if(Response){
                var htm = ``;
                AllProperties = Response;
                var PropName = extractPropData(Response);
                var TopIndexProp = null;
                
                if(uroles.includes('SUPERADMIN') || uroles.includes('OPROADMIN')){
                    TopIndexProp = PropName[0];
                    $.each(PropName, function (index, op){
                        htm += `<option ${index===0?'selected':''} value="${op.propId}">${op.propName}</option>`
                    });
                    var selt2 = `<select id="property_sector" class=" form-select" oninput="PropertyChange()">${htm}</select>`
                    $('#prop-selector-div').html(selt2);
                }
                else{
                    TopIndexProp = getPropDataById(Response,propid);
                    htm += `<option selected value="${TopIndexProp.propId}">${TopIndexProp.propName}</option>`
                    var selt2 = `<select id="property_sector" class=" form-select" oninput="PropertyChange()">${htm}</select>`
                    $('#prop-selector-div').html(selt2);
                }

                if(TopIndexProp) {
                    PropertyChange();
                }
            }
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {

            if (XMLHttpRequest.status === 401) {
                LogoutUser()
            }
            else if (XMLHttpRequest.status === 400) {
                unblockUI('#section-block');
                var errorResponse = XMLHttpRequest.responseText;
                NotifyToast('error', errorResponse)

            } else {
                console.log("An error occurred:", errorThrown);
                unblockUI('#section-block');
            }
        }
    });
}

function extractPropData(data) {
    return data.map(prop => ({
        propId: prop.propId,
        propName: prop.propName
    }));
}
function getPropDataById(data, propId) {
    const prop = data.find(prop => prop.propId === propId);
    if (prop) {
        return {
            propId: prop.propId,
            propName: prop.propName
        };
    }
    return null;
}
function getFullPropertyById(data, propId) {
    if (!data || !Array.isArray(data)) return null;
    const property = data.find(item => item.propId === propId);
    return property || null;
}
window.currentOpenPage = 1;
window.currentClosePage = 1;

function PropertyChange(openPage, closePage) {
    if (typeof openPage === 'number' && openPage > 0) {
        window.currentOpenPage = openPage;
    } else if (openPage === 1 || openPage === undefined || openPage === null) {
        if (typeof openPage !== 'number') {
            window.currentOpenPage = 1;
        }
    }

    if (typeof closePage === 'number' && closePage > 0) {
        window.currentClosePage = closePage;
    } else if (closePage === 1 || closePage === undefined || closePage === null) {
        if (typeof closePage !== 'number') {
            window.currentClosePage = 1;
        }
    }

    var NewProp = $('#property_sector').val();
    var form = new FormData();
    form.append("propId", NewProp);
    form.append("status", 'Open');
    form.append("openPageNumber", window.currentOpenPage);
    form.append("closePageNumber", window.currentClosePage);
    form.append("openPage", window.currentOpenPage);
    form.append("closePage", window.currentClosePage);
    form.append("pageNumber", window.currentOpenPage);
    form.append("pageSize", 10);

    var ep = applicationdomain + 'api/dailyjob/getallquickfixjobs';
    var jwt = GetStoredJwt();

    $.ajax({
        url: ep,
        type: 'POST',
        dataType: 'json',
        data: form,
        processData: false,
        contentType: false,
        headers: {
            "Authorization": "Bearer " + jwt
        },
        success: function (Response) {
          if(Response){
            var CurrentProperty = getFullPropertyById(AllProperties,NewProp);
            var XTeam = findTeamByEmail(userEmail, Response.teams || []);
            var UserCurrentTeamId = null;
            var UserSubTeams = [];
            if(XTeam){
                UserCurrentTeamId = XTeam.teamId;
                UserSubTeams = XTeam.propsubteams;
            }
            
            var control_open = {
                property : CurrentProperty,
                openjob: Response.open || [],
                teamId: UserCurrentTeamId,
                allTeams : Response.teams,
                userTeam: Response.userTeam,
                userSubTeamData : UserSubTeams,
                areas: Response.areas,
                pagination: Response.pagination || null,
                currentPage: window.currentOpenPage
            };
            
            var control_close = {
                property : CurrentProperty,
                closedjob: Response.close || [],
                teamId: UserCurrentTeamId,
                allTeams : Response.teams,
                userTeam: Response.userTeam,
                userSubTeamData : UserSubTeams,
                areas: Response.areas,
                pagination: Response.pagination || null,
                currentPage: window.currentClosePage
            };

            var Control_new = {
                property : CurrentProperty,
                teamId: UserCurrentTeamId,
                allTeams : Response.teams,
                userTeam: Response.userTeam,
                userSubTeamData : UserSubTeams,
                areas: Response.areas
            };
            
            LoadNewJobControl(Control_new);
            LoadOpneJobControl(control_open);
            LoadCloseJobControl(control_close);
          }
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            if (XMLHttpRequest.status === 401) {
                LogoutUser()
            }
            else if (XMLHttpRequest.status === 400) {
                var errorResponse = XMLHttpRequest.responseJSON;
                ErrorMessage()
            } else {
                console.log("An error occurred:", errorThrown);
            }
        }
    });
}

function FetchOpenJobPage(page) {
    PropertyChange(page, window.currentClosePage);
}

function FetchCloseJobPage(page) {
    PropertyChange(window.currentOpenPage, page);
}

function generatePaginationHTML(currentPage, totalPages, onClickFuncName) {
    if (totalPages <= 1) return '';

    let html = '<nav aria-label="Page navigation"><ul class="pagination pagination-sm mb-0 flex-wrap gap-1">';
    
    if (currentPage > 1) {
        html += `<li class="page-item"><a class="page-link" href="javascript:void(0)" onclick="${onClickFuncName}(${currentPage - 1})">&laquo; Prev</a></li>`;
    } else {
        html += `<li class="page-item disabled"><span class="page-link">&laquo; Prev</span></li>`;
    }

    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);

    if (startPage > 1) {
        html += `<li class="page-item"><a class="page-link" href="javascript:void(0)" onclick="${onClickFuncName}(1)">1</a></li>`;
        if (startPage > 2) {
            html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        if (i === currentPage) {
            html += `<li class="page-item active"><span class="page-link">${i}</span></li>`;
        } else {
            html += `<li class="page-item"><a class="page-link" href="javascript:void(0)" onclick="${onClickFuncName}(${i})">${i}</a></li>`;
        }
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        }
        html += `<li class="page-item"><a class="page-link" href="javascript:void(0)" onclick="${onClickFuncName}(${totalPages})">${totalPages}</a></li>`;
    }

    if (currentPage < totalPages) {
        html += `<li class="page-item"><a class="page-link" href="javascript:void(0)" onclick="${onClickFuncName}(${currentPage + 1})">Next &raquo;</a></li>`;
    } else {
        html += `<li class="page-item disabled"><span class="page-link">Next &raquo;</span></li>`;
    }

    html += '</ul></nav>';
    return html;
}

function RenderPaginationControls(containerId, currentPage, totalPages, totalRecords, pageSize, onClickFuncName) {
    if (totalRecords <= 0) {
        $(containerId).html('');
        return;
    }
    let startItem = (currentPage - 1) * pageSize + 1;
    let endItem = Math.min(currentPage * pageSize, totalRecords);
    let infoHTML = `<div class="text-muted small">Showing ${startItem} to ${endItem} of ${totalRecords} entries</div>`;
    let paginationHTML = generatePaginationHTML(currentPage, totalPages, onClickFuncName);
    
    $(containerId).html(infoHTML + paginationHTML);
}

function LoadNewJobControl(propid){
    LoadCustomControlWithRender('div-newjob-holder','new/new.html',propid,'osd')
}
function LoadOpneJobControl(propid){
    LoadCustomControlWithRender('div-openjob-holder','open/open.html',propid,'osd')
}
function LoadCloseJobControl(propid){
    LoadCustomControlWithRender('div-closejob-holder','close/closed.html',propid,'osd')
}

function ApplyCurrentDateTime() {
    $('#CurrentDateTime').text(getCurrentDatetime())
}

function getCurrentDatetime() {
    var currentDatetime = new Date();
    var day = String(currentDatetime.getDate()).padStart(2, '0');
    var month = String(currentDatetime.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    var year = currentDatetime.getFullYear();

    var hours = currentDatetime.getHours();
    var minutes = String(currentDatetime.getMinutes()).padStart(2, '0');
    var ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // The hour '0' should be '12'
    var formattedTime = hours + ':' + minutes + ' ' + ampm;

    var formattedDatetime = day + '/' + month + '/' + year + ', ' + formattedTime;
    return formattedDatetime;
}

function searchItems(searchText, data) {
    return data.filter(item => {
        return Object.values(item).some(value =>
            value && value.toString().toLowerCase().includes(searchText.toLowerCase())
        );
    });
}

function playMusic() {
    var url = `${applicationdomain}audio/play2.wav`
    const audio = new Audio(url);
    audio.play();
}


function findTeamByEmail(email, data) {
    // Iterate over each team in the data array
    for (let team of data) {
        // Check each member of the team
        for (let member of team.members) {
            // If the email matches, return the team
            if (member.email === email) {
                return team;
            }
        }
    }
    // If no team found with the provided email, return null
    return null;
}