# What is the project about?

datasteem is a tool that will fill a mysql database with infos about posts and users. more specifically :

for posts : block_id, author, title, date (unix timestamp god so much simpler to deal with those), text, permlink, image (if any), tag1,2,3,4,5, json_metadata, reward (in sbd), comment and upvotes number.

for the users : username, reputation, steem_posts, steem join date, followers, following count, steem power, delegated steem power.

It can fill the database in real time and in the case of a crash catch up if he missed a few blocks. 

# Technology stack 

It's a typical node program with a mysql database behind it.

I stream the blocks via dsteem and do most of the queries via steemjs. This is because I'm way more familiar with steemjs for querying data and I find it more convenient. And dsteem's stream api is just great, hence the crossover.

I strongly recommend the use of [pm2](http://pm2.keymetrics.io/) to handle the process.

# How do I run it ?

>  git pull git@github.com:drov0/datasteem.git && cd datasteem && npm i

install the database via the db.sql file

> pm2 start datasteem.js

# Roadmap 

I plan on polishing the tool and db scheme to scale and handle more data/operations. For instance I would love to store all voting operations to perform some data analysis on how the global stake is moving.

# How to contribute?

Submit a pull request, comment your code or write it in a way so it read itself and good to go :D

