import json
import time
import pymysql

'''
JSON Design
mandatory

type -- want/record
content
status -- todo/blocked/suspend/in progress/done/canceled/merged
originalDate:[year,month,day,hour,minutes,second,day of week,day of year,summer time]
updateDate:[year,month,day,hour,minutes,second,day of week,day of year,summer time]

optional

history[]:[[{updateDate:xxx,tag1:val1,tag2:val2,...}],[]...,[]]
blockList[]
subList[]
parentList[]
reference[]

'''

jsonTags = ['content', 'type', 'status', 'originalDate', 'updateDate', 'priority']
defaultJsonTagsValue = {'status':'todo', 'priority':'3 Low'}

fsm = {'statusList':['todo','cancel','in progress','block','suspend','done'],
       'path':[[0,1,1,1,1,0],
               [0,0,0,0,0,0],
               [0,1,0,0,1,1],
               [0,1,0,0,1,0],
               [0,1,1,0,0,0],
               [0,0,0,0,0,0]]}

defaultConfig = {'patternList':['all','todo','cancel','in progress','block','suspend','done'],'currentPattern':'in progress','currentDir':-1}

dbConnected = False


def GetFSM():
    return fsm

'''
config
'''

def GetConfig():
    LocalConfigNeedUpdate = False
    try:
        with open("config.json") as file:
            config = json.load(file)
        for tag in defaultConfig:
            if tag not in config:
                config[tag] = defaultConfig[tag]
                LocalConfigNeedUpdate = True
    except FileNotFoundError:
        config = defaultConfig
        LocalConfigNeedUpdate = True
    if LocalConfigNeedUpdate:
        SetConfig(config)
    return config

def SetConfig(config):
    with open("config.json","w") as file:
        json.dump(config, file, indent = 2)

def FilterWebDatas(webdatas):
    newWebdatas = []
    #filter out correct status
    config  = GetConfig()
    currentPattern = config['currentPattern']
    for webdata in webdatas:
        if currentPattern == "all" or webdata['status'] == currentPattern:
            newWebdatas.append(webdata)
    return newWebdatas
    #todo:filter out subList under certain ID

'''
Common Utils
'''
def JSon2WebData(jsonText):
    data = json.loads(jsonText)
    return data

def WebData2JSon(data):
    return json.dumps(data)

def BuildHistory(old, new):
    print(old)
    print(new)
    histories = []
    if 'history' in old:
        histories = old['history']
    newhistory = {}
    for tag in new:
        if tag == 'history':
            continue
        if tag not in old or new[tag] != old[tag]:
            newhistory[tag] = new[tag]
    histories.append(newhistory)
    return histories

def GetTagByID(cursor, ID, tag):
    result = SelectOneWebDataById(cursor, ID)
    content = result['content']
    data = JSon2WebData(content)
    if tag in data:
        return data[tag]
    else:
        print("ERROR:%s not exist" % tag)
        return None

'''
DB Operation
'''

def GetDBCursor():
    db = pymysql.connect(host="localhost",user="volactina",password="49sdCh483dFF",database="myweb")
    cursor = db.cursor(cursor=pymysql.cursors.DictCursor)
    # dbConnected = True
    return db, cursor

def CloseDB(db):
    db.close()
    # dbConnected = False

def DeleteWebDataById(db,cursor,ID):
    # if not dbConnected:
        # print("ERROR:DB NOT CONNECTED")
        # return
    sql = "delete from webdata where id = %s"
    cursor.execute(sql,ID)
    db.commit()
    print("delete id=%s"%ID)

def DBInsertNewWebData(db,cursor,content):
    sql = "insert into webdata(content) values (%s)"
    cursor.execute(sql,content)
    db.commit()

def SelectAllWebData(cursor):
    cursor.execute("select * from webdata")
    results = cursor.fetchall()
    return results

def SelectOneWebDataById(cursor,ID):
    sql = "select * from webdata where id = %s"
    cursor.execute(sql, ID)
    return cursor.fetchone()

def DBSelectSomeWebDatasById(cursor, IDs):
    if IDs == None:
        return []
    webdatas = []
    for ID in IDs:
        webdatas.append(SelectOneWebDataById(cursor, ID))
    return webdatas

def DBUpdateOneWebData(db,cursor,content,ID):
    sql = "update webdata set content = %s where id = %s"
    cursor.execute(sql,(content,ID))
    db.commit()

def UpdateOneWebDataCommon(db, cursor, ID, old, new):
    new['updateDate'] = time.localtime()
    new['history'] = BuildHistory(old, new)
    content = WebData2JSon(new)
    DBUpdateOneWebData(db, cursor, content, ID)

def DBGetMaxID(db, cursor):
    cursor.execute("select max(id) as id from webdata")
    result = cursor.fetchone()
    maxID = result['id']
    return maxID
    
'''
blockList[] subList[] parentList[]
'''
def AddSubList(db,cursor,ID,subID):
    old = JSon2WebData(SelectOneWebDataById(cursor,ID)['content'])
    new = old.copy()
    if 'subList' not in new:
        new['subList'] = []
    subIDs = set(new['subList'])
    subIDs.add(subID)
    new['subList'] = list(subIDs)
    UpdateOneWebDataCommon(db, cursor, ID, old, new)

def DelSubList(db, cursor, ID, subID):
    old = JSon2WebData(SelectOneWebDataById(cursor,ID)['content'])
    new = old.copy()
    if 'subList' not in new:
        new['subList'] = []
    subIDs = set(new['subList'])
    if subID in subIDs:
        subIDs.remove(subID)
    new['subList'] = list(subIDs)
    UpdateOneWebDataCommon(db, cursor, ID, old, new)

def AddParentList(db,cursor,ID,parentID):
    old = JSon2WebData(SelectOneWebDataById(cursor,ID)['content'])
    new = old.copy()
    if 'parentList' not in new:
        new['parentList'] = []
    parentIDs = set(new['parentList'])
    parentIDs.add(parentID)
    new['parentList'] = list(parentIDs)
    UpdateOneWebDataCommon(db, cursor, ID, old, new)

def DelParentList(db, cursor, ID, parentID):
    old = JSon2WebData(SelectOneWebDataById(cursor,ID)['content'])
    new = old.copy()
    if 'parentList' not in new:
        new['parentList'] = []
    parentIDs = set(new['parentList'])
    if parentID in parentIDs:
        parentIDs.remove(parentID)
    new['parentList'] = list(parentIDs)
    UpdateOneWebDataCommon(db, cursor, ID, old, new)

'''
Handle Op
'''
def HandleNewWant(db, cursor, request):
    new = {}
    old = {}
    for tag in jsonTags:
        if tag in request.form:
            new[tag] = request.form[tag]
    for tag in defaultJsonTagsValue:
        if tag not in new:
            new[tag] = defaultJsonTagsValue[tag]
    new['originalDate'] = time.localtime()
    new['updateDate'] = time.localtime()
    new['history'] = BuildHistory(old, new)
    content = WebData2JSon(new)
    DBInsertNewWebData(db, cursor, content)
    if 'parentID' in request.form and not request.form['parentID'] is None:
        newID = DBGetMaxID(db, cursor)
        parentID = int(request.form['parentID'])
        AddParentList(db, cursor, newID, parentID)
        AddSubList(db, cursor, parentID, newID)

def HandleGenralUpdate(db, cursor, request):
    ID = request.form['id']
    old = JSon2WebData(SelectOneWebDataById(cursor,ID)['content'])
    new = {}
    for tag in jsonTags:
        if tag in request.form:
            new[tag] = request.form[tag]
    for tag in old:
        if tag not in new:
            new[tag] = old[tag]
    UpdateOneWebDataCommon(db, cursor, ID, old, new)

def HandleAddSubList(db, cursor, request):
    ID = request.form['id']
    subID = request.form['subID']
    AddSubList(db, cursor, ID, subID)
    AddParentList(db, cursor, subID, ID)

def HandleDelSubList(db, cursor, request):
    ID = request.form['id']
    subID = request.form['subID']
    DelSubList(db, cursor, ID, subID)
    DelParentList(db, cursor, subID, ID)

def HandleAddParentList(db, cursor, request):
    ID = request.form['id']
    parentID = request.form['parentID']
    AddParentList(db, cursor, ID, parentID)
    AddSubList(db, cursor, parentID, ID)

def HandleDelParentList(db, cursor, request):
    ID = request.form['id']
    parentID = request.form['parentID']
    DelParentList(db, cursor, ID, parentID)
    DelSubList(db, cursor, parentID, ID)

def HandleConfigPattern(request):
    if 'pattern' not in request.form:
        print("ERROR:pattern not in request.form")
        return
    currentPattern = request.form['pattern']
    config  = GetConfig()
    config['currentPattern'] = currentPattern
    SetConfig(config)
    print("set currentPattern %s" % currentPattern)

def HandleConfigDir(request):
    if 'ID' not in request.form:
        print("ERROR:ID not in request.form")
        return
    currentID = int(request.form['ID'])
    config  = GetConfig()
    config['currentDir'] = currentID
    SetConfig(config)
    print("set currentID %s" % currentID)
    