import React from 'react'

import clsx from 'clsx';
import {Client} from 'paho-mqtt';
import moment from 'moment';


import {withStyles} from '@material-ui/styles';
import Card from '@material-ui/core/Card';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';

const useStyles = theme => ({
  tightCell: {
    padding: "8px 2px 6px 4px",
    fontSize: 13,
  },
  smallText: {
    fontSize: 12,
  },
  headerCell: {
    backgroundColor: "white",
    padding: "8px 6px 6px 6px",
  },
  tightRight: {
    textAlign: "right"
  },
});

class LogTable extends React.Component {
  constructor(props) {
    super(props);
    this.state = {listOfLogs: []};
    this.onConnect = this.onConnect.bind(this);
    this.onMessageArrived = this.onMessageArrived.bind(this);
  }

  async getData() {
    await fetch("./data/all_pioreactor.log.json")
      .then(response => {
        return response.json();
      })
      .then(data => {
        this.setState({listOfLogs: data});
      });
  }

  componentDidMount() {
    this.getData()
    this.client = new Client(
      "ws://pioreactorws.ngrok.io/",
      "client-log-table");
    this.client.connect({'onSuccess': this.onConnect});
    this.client.onMessageArrived = this.onMessageArrived;
  }

  onConnect() {
      this.client.subscribe(["pioreactor", "+", "+", "log"].join("/"))
  }

  onMessageArrived(message) {
    if (this.state.listOfLogs.length > 50){
      this.state.listOfLogs.pop()
    }
    const unit = message.topic.split("/")[1]
    this.state.listOfLogs.unshift({timestamp: moment().format("x"), unit: unit, message: message.payloadString})
    this.setState({
      listOfLogs: this.state.listOfLogs
    });
  }

  breakString(string){
    if (string.length > 5){
      return string.slice(0, 4) + "..."
    }
    return string
  }

  renameUnit(name){
    if (!this.props.config['dashboard.rename']){
      return name
    }
    return (this.props.config['dashboard.rename'][name]) || name
  }

  render(){
    const { classes } = this.props;
    return (
      <Card>
        <TableContainer style={{ height: "700px", width: "100%", overflowY: "scroll"}}>
          <Table stickyHeader size="small" aria-label="log table">
             <TableHead>
              <TableRow>
                <TableCell align="center" colSpan={3} className={[classes.headerCell, classes.tightCell].join(" ")}> Event logs </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className={clsx(classes.headerCell, classes.tightCell)}>Timestamp</TableCell>
                <TableCell className={clsx(classes.headerCell, classes.tightCell)}>Message</TableCell>
                <TableCell className={clsx(classes.headerCell, classes.tightCell)}>Unit</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {this.state.listOfLogs.map((log, i) => (
                <TableRow key={i}>
                  <TableCell className={clsx(classes.tightCell, classes.smallText)}> {moment(log.timestamp, 'x').format('HH:mm:ss')} </TableCell>
                  <TableCell className={clsx(classes.tightCell, classes.smallText)}> {log.message} </TableCell>
                  <TableCell className={clsx(classes.tightCell, classes.smallText)}>{this.renameUnit(log.unit)}</TableCell>
                </TableRow>
                ))
              }
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
  )}
}



export default withStyles(useStyles)(LogTable);
