var Horseman = require('node-horseman');
var horseman = new Horseman({injectJquery:false});
var crypto = require('crypto');

var MongoClient = require('mongodb').MongoClient;
var assert = require('assert')
var ObjectId = require('mongodb').ObjectID;
var url = 'mongodb://localhost:27017/course-parser';

var courseUrl = "https://gra206.aca.ntu.edu.tw/classrm/WebCRUse.aspx",
    hash = [];
horseman
.on('consoleMessage', function( msg ){
  console.log(msg);
})
.on('error',function(err){
  console.log(err);
});

var list = 
horseman
.open(courseUrl)
.text("select#ctl00_ContentPlaceHolder1_dropRm");

list = list.replace(/\n/g,'').split('\t');

MongoClient.connect(url, function(err, db) {
  assert.equal(null, err);
  for(var count = 1;count<list.length; ++count){
    console.log("Current Page: "+count+"/"+"Total Pages: "+(list.length-1));
    var res =
    horseman
    .select('#ctl00_ContentPlaceHolder1_dropRm',list[count])
    .click('#ctl00_ContentPlaceHolder1_Button1')
    .waitForNextPage()
    .injectJs('./jquery.min.js')
    .evaluate(function(){
      var ret = [];
      var prevCheck = -1;
      $('#ctl00_ContentPlaceHolder1_GridView2 td.cruse_item>span:first-child').each(function(i,v){
        $t = $(this);
        var obj = {};
        if($t.text()!==""){
          var $data = $t.next().find('tbody tr td:odd span');
          var time = {};
          obj.courseNo = $data[0].innerHTML;
          obj.classNo = $data[1].innerHTML.replace(/\s+/g,'')=="" ? '0': $data[1].innerHTML;
          obj.courseName = $data[2].innerHTML;
          obj.teacher = $data[3].innerHTML.replace(/\s+/g,'');
          obj.location = [$data[4].innerHTML];
          obj.time = [];
          time.day = Math.floor(i/15);
          if(ret.length &&
            (ret[ret.length-1].courseNo == obj.courseNo ) &&
            (ret[ret.length-1].classNo == obj.classNo ) &&
            (ret[ret.length-1].teacher == obj.teacher ) &&
            (prevCheck == time.day)
            ){
            ret[ret.length-1].time[0].endTime = i%15;
            return;
          }

          time.startTime = time.endTime = i%15;
          prevCheck = time.day;
          obj.time.push(time);

          ret.push(obj);
        }
      });
      return ret;
    });
    for( i in res ){
      var md5 = crypto.createHash('md5'),
      obj = res[i],
      str = obj.courseNo+obj.classNo+obj.teacher;
      md5.update(str);
      var dig = md5.digest('hex');
      if(!hash[dig]){
        hash[dig] = count;
        db.collection('course').insertOne(obj,function(err,res){
          console.log('Insert success');
        });
      }
      else{
        var q = {time:obj.time[0]};
        if(hash[dig]!==count){
          hash[dig]=count;
          q.location = obj.location[0];
        }
        db.collection('course').updateOne({ 
          courseNo: obj.courseNo,
          teacher: obj.teacher,
          classNo: obj.classNo 
        },
        {
          $push: q
        },
        function(err,res){
          console.log('Update success');
        })
      }
    }
  }
  db.close()
  horseman.close();
});
