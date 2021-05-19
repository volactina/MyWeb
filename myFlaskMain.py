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
            myWebUtil.InsertNewWebData(db,cursor,myWebUtil.Request2JSon(request))
        elif op == "delete":
            webdataid = request.form['id']
            myWebUtil.DeleteWebDataById(db,cursor,webdataid)
        elif op == "update":
            webdataid = request.form['id']
            old = myWebUtil.SelectOneWebDataById(cursor,webdataid)
            new = myWebUtil.Request2JSon(request,myWebUtil.JSon2WebData(old['content']))
            myWebUtil.DBUpdateOneWebData(db,cursor,new,webdataid)
        elif op == "config":
            if 'pattern' not in request.form:
                print("ERROR:pattern not in request.form")
            else:
                currentPattern = request.form['pattern']
                myWebUtil.SetConfig(currentPattern)
                print("set currentPattern %s"%currentPattern)
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
    results = myWebUtil.SelectAllWebData(cursor)
    myWebUtil.CloseDB(db)
    webdatas = []
    for row in results:
        webdata = {}
        webdata = myWebUtil.JSon2WebData(row['content'])
        webdata['id'] = row['id']
        webdatas.append(webdata)
    webdatas = sorted(webdatas,key=lambda x:x['updateDate'],reverse=True)
    return render_template("wantanddo.html", webdatas = webdatas, fsm = myWebUtil.GetFSM(), config = myWebUtil.GetConfig())

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