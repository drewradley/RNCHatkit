// App.js
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { ChatManager, TokenProvider } from "@pusher/chatkit";

import Login from "./app/screens/Login";
import Users from "./app/screens/Users";
import Chat from "./app/screens/Chat";


const instanceLocatorId = "0c189a30-bee2-488b-a6db-6797b29c25f2";
    const presenceRoomId = 19385076; // room ID of the general room created through the chatKit inspector

    const tokenProvider = new TokenProvider({
      url: `https://us1.pusherplatform.io/services/chatkit_token_provider/v1/${instanceLocatorId}/token`
    });
    const chatServer = "http://192.168.1.73:3000/users";

export default class App extends React.Component {
  state = {
    userHasLoggedIn: false, // whether the user is logged in or not
    currentScreen: "login", // the current screen being shown, this defaults to the login screen
    username: null, // the username of the current user
    users: [], // the array of users returned by Chatkit
    presenceRoomId: null, // the ID of the general room (we're simply copying it over to the state)
    currentRoomId: null, // the ID of the current room
    chatWithUser: null, // the username of the user you're currently chatting with
    message: "", // the message you're currently typing
    messages: [], // the array of messages currently being shown in the screen
    chatWithUserIsTyping: false, // if the user you're chatting with is currently typing something or not
    refreshing: false, // if the app is currently fetching the old messages or not
    inChatRoom: false // if you're currently in a chat room or not
  };

  constructor(props) {
    super(props);
    this.currentUser = null;
    this.roomId = null;
    this.chatWithUser = null;
  }

  render() {
    return (
      <View style={styles.container}>
        {this.state.currentScreen == "login" && (
          <Login
            username={this.state.username}
            updateUsername={this.updateUsername}
            enterChat={this.enterChat}
          />
        )}

        {this.state.currentScreen == "users" && (
          <Users
            userHasLoggedIn={this.state.userHasLoggedIn}
            users={this.sortUsers(this.state.users)}
            beginChat={this.beginChat}
            leavePresenceRoom={this.leavePresenceRoom}
          />
        )}

        {this.state.currentScreen == "chat" && (
          <Chat
            message={this.state.message}
            backToUsers={this.backToUsers}
            updateMessage={this.updateMessage}
            sendMessage={this.sendMessage}
            chatWithUser={this.state.chatWithUser}
            chatWithUserIsTyping={this.state.chatWithUserIsTyping}
            messages={this.state.messages}
            refreshing={this.state.refreshing}
            loadPreviousMessages={this.loadPreviousMessages}
            setScrollViewRef={this.setScrollViewRef}
            inChatRoom={this.state.inChatRoom}
          />
        )}
      </View>
    );
  }

  // next: add updateUsername function
  updateUsername = username => {
    this.setState({
      username
    });
  };

  // next: add enterChat function
  enterChat = () => {
    fetch(chatServer, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username: this.state.username
      })
    })
      .then(response => { // request succeeded
        // initialize a ChatManager instance
        this.chatManager = new ChatManager({
          instanceLocator: `v1:us1:${instanceLocatorId}`,
          userId: this.state.username,
          tokenProvider
        });

        // connect the user to Chatkit
        this.chatManager
          .connect()
          .then(currentUser => {
            this.currentUser = currentUser;

            this.setState({
              presenceRoomId: presenceRoomId // save ID of the general room in the state
            });

            // subscribe the user to the general room
            currentUser
              .subscribeToRoom({
                roomId: presenceRoomId,
                // action hooks. These functions will be executed when any of the four events below happens
                hooks: {
                  onUserCameOnline: this.handleInUser,
                  onUserJoinedRoom: this.handleInUser,
                  onUserLeftRoom: this.handleOutUser,
                  onUserWentOffline: this.handleOutUser
                }
              })
              .then(room => {
                let new_users = [];
                room.users.forEach(user => {
                  if (user.id != this.currentUser.id) {
                    let is_online =
                      user.presence.state == "online" ? true : false;

                    new_users.push({
                      id: user.id,
                      name: user.name,
                      is_online
                    });
                  }
                });

                this.setState({
                  userHasLoggedIn: true,
                  users: new_users
                });
              })
              .catch(err => {
                console.log(`Error joining room ${err}`);
              });
          })
          .catch(error => {
            console.log("error with chat manager", error);
          });
      })
      .catch(error => {
        console.log("error in request: ");
      });

    this.setState({
      currentScreen: "users"
    });
  };
  // next: add handleInUser function
  handleInUser = user => {
    let currentUsers = [...this.state.users];
    let userIndex = currentUsers.findIndex(item => item.id == user.id);

    if (userIndex != -1) {
      currentUsers[userIndex]["is_online"] = true;
    }

    if (user.id != this.currentUser.id && userIndex == -1) {
      currentUsers.push({
        id: user.id,
        name: user.name,
        is_online: true
      });
    }

    this.setState({
      users: currentUsers
    });
  };
  // next: add sortUsers function
  sortUsers = users => {
    return users.slice().sort((x, y) => {
      return y.is_online - x.is_online;
    });
  };
  // next: add handleOutUser function
  handleOutUser = user => {
    let users = [...this.state.users];
    let new_users = users.filter(item => {
      if (item.id == user.id) {
        item.is_online = false;
      }
      return item;
    });

    this.setState({
      users: new_users
    });
  };
  // next: add beginChat function
  beginChat = user => {
    // construct the room ID
    let roomName = [user.id, this.currentUser.id];
    roomName = roomName.sort().join("_") + "_room";

    this.currentUser
      .getJoinableRooms()
      .then(rooms => {
        var chat_room = rooms.find(room => {
          return room.name == roomName;
        });

        if (!chat_room) {
          this.currentUser
            .createRoom({
              name: roomName,
              private: false // so they could find it in joinable rooms
            })
            .then(room => {
              this.subscribeToRoom(room.id, user.id);
            })
            .catch(err => {
              console.log(`error creating room ${err}`);
            });
        } else {
          this.subscribeToRoom(chat_room.id, user.id);
        }
      })
      .catch(err => {
        console.log(`error getting joinable rooms: ${err}`);
      });
  };
  // next: add subscribeToRoom function
  subscribeToRoom = (roomId, chatWith) => {
    this.roomId = roomId;
    this.chatWithUser = chatWith;

    this.currentUser
      .subscribeToRoom({
        roomId: roomId,
        hooks: {
          onNewMessage: this.onReceiveMessage,
          onUserStartedTyping: this.onUserTypes,
          onUserStoppedTyping: this.onUserNotTypes
        },
        messageLimit: 5 // default number of messages to load after subscribing to the room
      })
      .then(room => {
        this.setState({
          inChatRoom: true
        });
        console.log(`successfully subscribed to room`);
      })
      .catch(err => {
        console.log(`error subscribing to room: ${err}`);
      });

    this.setState({
      currentScreen: "chat", // set current screen to Chat screen
      currentRoomId: roomId,
      chatWithUser: chatWith
    });
  };
  // next: add onReceiveMessage function
  onReceiveMessage = message => {
    let isCurrentUser = this.currentUser.id == message.sender.id ? true : false;

    let messages = [...this.state.messages];
    messages.push({
      key: message.id.toString(),
      username: message.sender.name,
      msg: message.text,
      datetime: message.createdAt,
      isCurrentUser // this one determines the styling used for the chat bubble
    });

    this.setState(
      {
        messages
      },
      () => {
        this.scrollViewRef.scrollToEnd({ animated: true });
      }
    );
  };

  // next: add onUserTypes function
  onUserTypes = user => {
    this.setState({
      chatWithUserIsTyping: true
    });
  };

  onUserNotTypes = user => {
    this.setState({
      chatWithUserIsTyping: false
    });
  };

  // next: add backToUsers function 
  backToUsers = () => {
    this.currentUser
      .leaveRoom({ roomId: this.roomId })
      .then(room => {
        this.currentUser.roomSubscriptions[this.roomId].cancel(); // cancel all the room subscriptions

        // reset the values
        this.roomId = null;
        this.chatWithUser = null;

        this.setState({
          currentScreen: "users",
          messages: [],
          currentRoomId: null,
          chatWithUser: null,
          inChatRoom: false
        });
      })
      .catch(err => {
        console.log(
          `something went wrong while trying to leave the room: ${err}`
        );
      });
  };

  // next: add updateMessage function
  updateMessage = message => {
    this.setState({
      message
    });
    this.currentUser.isTypingIn({ roomId: this.state.currentRoomId });
  };

  // next: add sendMessage function
  sendMessage = () => {
    if (this.state.message) {
      this.currentUser
        .sendMessage({
          text: this.state.message,
          roomId: this.state.currentRoomId
        })
        .then(messageId => {
          this.setState({
            message: ""
          });
        })
        .catch(err => {
          console.log(`error adding message to room: ${err}`);
        });
    }
  };

  // next: add loadPreviousMessages function
  loadPreviousMessages = () => {
    const oldestMessageId = Math.min(
      ...this.state.messages.map(m => parseInt(m.key))
    );

    this.setState({
      refreshing: true
    });

    this.currentUser
      .fetchMessages({
        roomId: this.state.currentRoomId,
        initialId: oldestMessageId,
        direction: "older",
        limit: 5
      })
      .then(messages => {
        let currentMessages = [...this.state.messages];
        let old_messages = [];

        messages.forEach(msg => {
          let isCurrentUser = this.currentUser.id == msg.sender.id ? true : false;

          old_messages.push({
            key: msg.id.toString(),
            username: msg.sender.name,
            msg: msg.text,
            datetime: msg.createdAt,
            isCurrentUser
          });
        });

        currentMessages = old_messages.concat(currentMessages);

        this.setState({
          refreshing: false,
          messages: currentMessages
        });
      })
      .catch(err => {
        console.log(`error loading previous messages: {$err}`);
      });
  };

  // next: add setScrollViewRef function
  setScrollViewRef = ref => {
    this.scrollViewRef = ref;
  };

  // next: add leavePresenceRoom function
  leavePresenceRoom = () => {
    this.currentUser
      .leaveRoom({ roomId: this.state.presenceRoomId })
      .then(room => {
        this.currentUser.roomSubscriptions[this.state.presenceRoomId].cancel();
        this.currentUser = null;
        this.setState({
          presenceRoomId: null,
          users: [],
          userHasLoggedIn: false,
          currentScreen: "login"
        });
      })
      .catch(err => {
        console.log(
          `error leaving presence room ${this.state.presenceRoomId}: ${err}`
        );
      });
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center"
  }
});
