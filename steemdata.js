const {Client} = require('dsteem')
const connection = require('./config.js');
const {promisify} = require('util');
const fn = promisify(connection.query).bind(connection);


var es = require('event-stream') // npm install event-stream
var util = require('util')
const steem = new Client('https://api.steemit.com')



function setupSteemjs() {
    const steem = require('steem');
    steem.api.setOptions({url: 'https://api.steemit.com'});
    return steem;
}




async function parseBlock(blocknb)
{

    console.log(blocknb);

    const block = await steem.database.getBlock(blocknb)
    const tx = block['transactions'];

    const time = (new Date(Date.parse(block['timestamp']))).getTime()/1000;

    for (let i = 0; i < tx.length; i++)
    {
        for (let y = 0; y < tx[i]['operations'].length; y++)
        {
           if (tx[i]['operations'][y][0] === "comment")
           {
               const post = tx[i]['operations'][y][1];

               if (post['parent_author'] === "") // if it's empty it's a post.
               {
                   var  json_metadata = [];
                   try {
                       json_metadata = JSON.parse(post['json_metadata'])
                   } catch(e) {
                       console.log(e)
                   }

                   let tags = (json_metadata['tags']? json_metadata['tags'] : []);
                   let img = "";

                   if (json_metadata['image'] && json_metadata['image'].length > 0)
                       img = json_metadata['image'][0];

                   fn("INSERT INTO `post` (`id`,`block_id`, `author`, `title`,`date`, `text`, `permlink`, `image`, `tag1`, `tag2`, `tag3`, `tag4`, `tag5`, `json_metadata`, `reward`, `comments`, `upvotes`, `last_updated`) VALUES(NULL,?,?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,-1,-1,-1,-1)",
                           [blocknb, post['author'] , post['title'], time, "", post['permlink'],img , post['parent_permlink'], (tags[1] ? tags[1] : ''), (tags[2] ? tags[2] : ''), (tags[3] ? tags[3] : ''), (tags[4] ? tags[4] : ''), post['json_metadata']])

                   // update/add user
                   const data = await get_user_data(post['author']);
                   fn("INSERT INTO user(`id`, `username`, `reputation`, `steem_posts`, `steem_join`, `followers`, `following`, `sp`, `delegated_sp`, last_updated) VALUES(NULL, ?,?,?,?,?,?,?,?,?)" +
                       " ON DUPLICATE KEY UPDATE reputation = ?, steem_posts = ?, followers = ?, following = ?, sp = ?, delegated_sp = ?, last_updated = ?",
                       [post['author'], data['reputation'], data['post_count'], data['join_date'], data['followers'], data['following'], data['sp'], data['delegated'],Math.floor(new Date().getTime() / 1000),
                           data['reputation'], data['post_count'], data['followers'], data['following'], data['sp'], data['delegated'],Math.floor(new Date().getTime() / 1000)])

               }
           } else if (tx[i]['operations'][y][0] === "vote")
           {
               const vote = tx[i]['operations'][y][1];
               const exists = await fn("select id from post where author = ? AND permlink = ?", [vote['author'], vote['permlink']]);

               if (exists.length !== 0) {

                   const data = await get_steem_data(vote['author'], vote['permlink']);

                   fn("update post set text = ?, reward = ?, comments = ?, upvotes = ?, last_updated = ? where author = ? AND permlink = ?",
                       [data['text'], data['reward'], data['comments'], data['upvotes'], time, vote['author'], vote['permlink']]);
            }
           }
        }
    }


}



function get_user_data(username) {
    return new Promise(resolve => {
        const steemjs = setupSteemjs();
        steemjs.api.getAccounts([username], function (err, account) {
            if (err) {
                console.log(err)
                return resolve(get_user_data(username));
            }
            const reputation = steemjs.formatter.reputation(account[0].reputation);
            var vesting_shares, delegated_vesting_shares, received_vesting_shares, total_vesting_shares,
                total_vesting_fund_steem = null;
            vesting_shares = account[0].vesting_shares;
            delegated_vesting_shares = account[0].delegated_vesting_shares;
            received_vesting_shares = account[0].received_vesting_shares;

            steemjs.api.getDynamicGlobalProperties(function (err, properties) {
                if (err) {
                    console.log(err)
                    return resolve(get_user_data(username));
                }

                total_vesting_shares = properties.total_vesting_shares;
                let total_vesting_fund = properties.total_vesting_fund_steem;

                // Handle Promises, when you’re sure the two functions were completed simply do:
                var steem_power = steemjs.formatter.vestToSteem(vesting_shares, total_vesting_shares, total_vesting_fund);
                var delegated_steem_power = steemjs.formatter.vestToSteem((received_vesting_shares.split(' ')[0] - delegated_vesting_shares.split(' ')[0]) + ' VESTS', total_vesting_shares, total_vesting_fund);

                steem_power = Math.floor(steem_power*1000)/1000
                delegated_steem_power = Math.floor(delegated_steem_power*1000)/1000
                steemjs.api.getFollowCount(username, function (err, follow_data) {
                    if (err) {
                        console.log(err)
                        return resolve(get_user_data(username));
                    }

                    const followers = follow_data.follower_count;
                    const following = follow_data.following_count;

                    const post_count = account[0].post_count;
                    const join_date = new Date(account[0].created).getTime()/1000;


                    resolve({"followers" : followers, "reputation" : reputation, "sp" : steem_power, "delegated" : delegated_steem_power, "following" : following, "post_count": post_count, "join_date" : join_date});
                });
            });
        });
    });
}




function get_steem_data(username, permlink){
    return new Promise(resolve => {
        const steemjs = setupSteemjs();

        steemjs.api.getContent(username, permlink, function(err, result) {
            if (err)
            {
                console.log("api error");
                resolve(get_steem_data(username, permlink));
                return;
            }
            const reward = (Math.ceil(parseFloat(result['pending_payout_value'].replace(" SBD", ""))*100)/100).toString();
            const comments  = result['children'].toString();
            const upvotes = result['active_votes'].length.toString();
            const text = result['body'];

            resolve({"reward" : reward, "comments" : comments, "upvotes" : upvotes, "text" : text});
        });
    });
}




async function update_user()
{

    console.log("Updating user data");
    return new Promise(async resolve => {
        const now = Math.floor(new Date().getTime() / 1000);
        const users = await fn("select username from user WHERE ?-last_updated > 10800", [now]);
        for (let i = 0; i < users.length; i++) {
            const data = await get_user_data(users[i]['author']);
            fn("UPDATE reputation = ?, steem_posts = ?, followers = ?, following = ?, sp = ?, delegated_sp = ?, last_updated = ? WHERE username = ?",
                [data['reputation'], data['post_count'], data['followers'], data['following'], data['sp'], data['delegated'],Math.floor(new Date().getTime() / 1000),users[i]['author'] ])
        }

        console.log("finished updating " + users.length.toString() + " users in " + (Math.floor(new Date().getTime() / 1000) - now).toString() + "seconds");

        resolve(users.length);
    });
}

async function update_data()
{
    console.log("Updating post data");
    return new Promise(async resolve => {
        const _6_days_ago = Math.floor(new Date().getTime() / 1000) - 86400 * 6;
        const now = Math.floor(new Date().getTime() / 1000);
        const posts = await fn("select author, permlink from post where date > ? AND ?-last_updated > 3600", [_6_days_ago,now]);

        for (let i = 0; i < posts.length; i++) {
            const data = await
            get_steem_data(posts[i]['author'], posts[i]['permlink']);

            fn("update post set text = ?, reward = ?, comments = ?, upvotes = ?, last_updated = ? where author = ? AND permlink = ?",
                [data['text'], data['reward'], data['comments'], data['upvotes'],Math.floor(new Date().getTime() / 1000), posts[i]['author'], posts[i]['permlink']])

        }

        console.log("finished updating "+posts.length.toString()+" posts in "+(Math.floor(new Date().getTime() / 1000)- now).toString()+ "seconds");

        resolve(posts.length)
    });
}


function wait(time)
{
    return new Promise(resolve => {
        setTimeout(() => resolve('☕'), time*1000); // miliseconds to seconds
    });
}


async function main() {

    var stream = steem.blockchain.getBlockNumberStream()

    stream.pipe(es.map(function(block, callback) {
        callback(null, parseBlock(block))
    }))


    while (true)
    {
        const posts_count = await update_data();
        const user_count = await update_user();
        if (posts_count === 0 && user_count === 0)
            await wait(4); // we are up to date, waiting one block
    }
}

main();



