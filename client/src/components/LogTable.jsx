import React from 'react'

import clsx from 'clsx';
import {Client} from 'paho-mqtt';
import moment from 'moment';


import {withStyles} from '@material-ui/styles';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import Typography from '@material-ui/core/Typography';
import Box from '@material-ui/core/Box';
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
  errorLog: {
    backgroundColor: "#ff7961"
  },
  warningLog: {
    backgroundColor: "#FFEA8A"
  }
});

class LogTable extends React.Component {
  constructor(props) {
    super(props);
    this.state = {listOfLogs: []};
    this.onConnect = this.onConnect.bind(this);
    this.onMessageArrived = this.onMessageArrived.bind(this);
  }

  async getData() {
    if (!this.props.experiment){
      return
    }
    await fetch("/recent_logs/" + encodeURIComponent(this.props.experiment) + "?" + new URLSearchParams({
        min_level: this.props.config.logging.ui_log_level
      }))
      .then(response => {
        return response.json();
      })
      .then(data => {
        this.setState({listOfLogs: data});
      }).catch((e) => {
        console.log(e)
      });
  }

  componentDidMount() {
    this.getData()
    if (this.props.config.remote && this.props.config.remote.ws_url) {
      this.client = new Client(
        `ws://${this.props.config.remote.ws_url}/`,
        "webui_LogTable" + Math.random()
      )}
    else {
      this.client = new Client(
        `${this.props.config['network.topology']['leader_address']}`, 9001,
        "webui_LogTable" + Math.random()
      );
    }
    this.client.connect({timeout: 180, 'onSuccess': this.onConnect, reconnect: true});
    this.client.onMessageArrived = this.onMessageArrived;
  }

  componentDidUpdate(prevProps) {
     if (prevProps.experiment !== this.props.experiment) {
      this.getData()
     }
  }

  onConnect() {
      this.client.subscribe(["pioreactor", "+", "+", "app_logs_for_ui"].join("/"))
  }

  onMessageArrived(message) {
    if (this.state.listOfLogs.length > 50){
      this.state.listOfLogs.pop()
    }
    const unit = message.topic.split("/")[1]
    const payload = message.payloadString
    this.state.listOfLogs.unshift(
      {timestamp: moment().format('YYYY-MM-DD[T]HH:mm:ss.SSSSS[Z]'), pioreactor_unit: unit, message: payload, is_error: payload.includes("Error"), is_warning: payload.includes("Warning")}
    )
    this.setState({
      listOfLogs: this.state.listOfLogs
    });
  }

  renameUnit(name){
    if (!this.props.config['ui.rename']){
      return name
    }
    return (this.props.config['ui.rename'][name]) || name
  }

  render(){
    const { classes } = this.props;
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" component="h2">
            <Box fontWeight="fontWeightRegular">
              Event Logs
            </Box>
          </Typography>
          <TableContainer style={{ height: "700px", width: "100%", overflowY: "scroll"}}>
            <Table stickyHeader size="small" aria-label="log table">
               <TableHead>
                <TableRow>
                  <TableCell className={clsx(classes.headerCell)}>Timestamp</TableCell>
                  <TableCell className={clsx(classes.headerCell)}>Message</TableCell>
                  <TableCell className={clsx(classes.headerCell)}>Pioreactor</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {this.state.listOfLogs.map((log, i) => (
                  <TableRow key={i}>
                    <TableCell className={clsx(classes.tightCell, classes.smallText, {[classes.errorLog]: log.is_error, [classes.warningLog]: log.is_warning})}>
                      <span title={moment(log.timestamp, 'YYYY-MM-DD[T]HH:mm:ss.SSSSS[Z]').local().format('YYYY-MM-DD HH:mm:sss')}>{moment(log.timestamp, 'YYYY-MM-DD[T]HH:mm:ss.SSSSS[Z]').local().format('HH:mm:ss')} </span>
                    </TableCell>
                    <TableCell className={clsx(classes.tightCell, classes.smallText, {[classes.errorLog]: log.is_error, [classes.warningLog]: log.is_warning})}> {log.message} </TableCell>
                    <TableCell className={clsx(classes.tightCell, classes.smallText, {[classes.errorLog]: log.is_error, [classes.warningLog]: log.is_warning})}> {this.renameUnit(log.pioreactor_unit)}</TableCell>
                  </TableRow>
                  ))
                }
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
  )}
}



export default withStyles(useStyles)(LogTable);
