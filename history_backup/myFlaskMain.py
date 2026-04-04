from flask import Flask, request, render_template
import myWebUtil

app = Flask(__name__)

@app.route('/', methods=['GET', 'POST'])
def home():
    return render_template('test.html')

@app.route('/<filename>', methods=['GET', 'POST'])
def StaticWebs(filename):
    return render_template(filename)

@app.route('/wantanddo.html', methods=['GET', 'POST'])
def DBOperation():
    print(request.method)
    db, cursor = myWebUtil.GetDBCursor()
    # print(myWebUtil.dbConnected)
    if request.method == 'POST':
        op = request.form['op']
        print("op=%s" % op)
        if op == "add":
            myWebUtil.HandleNewWant(db, cursor, request)
        elif op == "delete":
            webdataid = request.form['id']
            myWebUtil.DeleteWebDataById(db,cursor,webdataid)
        elif op == "update":
            myWebUtil.HandleGenralUpdate(db, cursor, request)
        elif op == "config pattern":
            myWebUtil.HandleConfigPattern(request)
        elif op == "config dir":
            myWebUtil.HandleConfigDir(request)
        elif op == "add subList":
            myWebUtil.HandleAddSubList(db, cursor, request)
        elif op == "add parent":
            myWebUtil.HandleAddParentList(db, cursor, request)
        elif op == "del subList":
            myWebUtil.HandleDelSubList(db, cursor, request)
        elif op == "del parent":
            myWebUtil.HandleDelParentList(db, cursor, request)
        else:
            print("%s not supported" % op)
    config = myWebUtil.GetConfig()
    config['parentList'] = []
    curID = config['currentDir']
    if curID == -1:
        results = myWebUtil.SelectAllWebData(cursor)
        config['curContent'] = 'root'
    else:
        results = myWebUtil.DBSelectSomeWebDatasById(cursor, myWebUtil.GetTagByID(cursor, curID, 'subList'))
        config['parentList'] = myWebUtil.GetTagByID(cursor, curID, 'parentList')
        config['parentList'] = [] if config['parentList'] == None else config['parentList']
        config['curContent'] = myWebUtil.GetTagByID(cursor, curID, 'content')
    myWebUtil.CloseDB(db)
    webdatas = []
    for row in results:
        webdata = {}
        webdata = myWebUtil.JSon2WebData(row['content'])
        webdata['id'] = row['id']
        webdatas.append(webdata)
    webdatas = myWebUtil.FilterWebDatas(webdatas)
    for webdata in webdatas:
        if 'priority' not in webdata:
            webdata['priority'] = '3 Low'
    webdatas = sorted(webdatas,key=lambda x:(-int(x['priority'][0]),x['updateDate']),reverse=True)
    return render_template("wantanddo.html", webdatas = webdatas, fsm = myWebUtil.GetFSM(), config = config)

@app.route('/WebDevelopLog.html', methods=['GET'])
def WebDevelopLogGet():
    db, cursor = myWebUtil.GetDBCursor()
    cursor.execute("select * from weblogs")
    results = cursor.fetchall()
    myWebUtil.CloseDB(db)
    logs = []
    for row in results:
        log = [row[0],row[1]]
        logs.append(log)
    logs.reverse()
    return render_template('WebDevelopLog.html', logs = logs)

@app.route('/WebDevelopLog.html', methods=['POST'])
def WebDevelopLogPost():
    content  = request.form['content']
    sql = "insert into weblogs(log_content) values ('%s')" % (content)
    db, cursor = myWebUtil.GetDBCursor()
    cursor.execute(sql)
    db.commit()
    myWebUtil.CloseDB(db)
    return WebDevelopLogGet()

@app.route('/signin', methods=['POST'])
def signin():
    username = request.form['username']
    password = request.form['password']
    if username=='admin' and password=='password':
        return render_template('signin-ok.html', username=username)
    return render_template('form.html', message='Bad username or password', username=username)

if __name__ == '__main__':
    app.run(debug=True)
    
bootstrap = Bootstrap(app)