import React, {useState, useEffect} from 'react'
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import CardActions from "@material-ui/core/CardActions";
import Button from '@material-ui/core/Button';
import {Client, Message} from 'paho-mqtt';
import Typography from "@material-ui/core/Typography";
import Divider from "@material-ui/core/Divider";
import CardHeader from "@material-ui/core/CardHeader";
import { makeStyles } from "@material-ui/styles";
import TextField from '@material-ui/core/TextField';
import InputAdornment from "@material-ui/core/InputAdornment";
import Box from "@material-ui/core/Box";
import ClearIcon from '@material-ui/icons/Clear';
import {withStyles} from '@material-ui/styles';

import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';

import {ButtonActionDialog, ButtonChangeIODialog} from "./UnitCards"
import PioreactorIcon from "./PioreactorIcon"



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



class MediaCard extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
        mediaThroughputPerUnit: {},
        altMediaThroughputPerUnit: {},
        mediaThroughput: 0,
        altMediaThroughput: 0,
        rates: {all: {mediaRate: 0, altMediaRate: 0}},
      };
    this.onConnect = this.onConnect.bind(this);
    this.onMessageArrived = this.onMessageArrived.bind(this);
  }

  async getRecentRates() {
     await fetch("/recent_media_rates/" + this.props.experiment)
    .then((response) => {
      return response.json();
    })
    .then((data) => {
      this.setState(prevState => ({...prevState, rates: data}))
    });
  }

  componentDidMount() {
    this.client = new Client(
      "ws://pioreactorws.ngrok.io/",
      "client-throughput");
    this.client.connect({'onSuccess': this.onConnect});
    this.client.onMessageArrived = this.onMessageArrived;
  }

  componentDidUpdate(prevProps) {
     if (prevProps.experiment !== this.props.experiment) {
      this.getRecentRates()
     }
  }

  onConnect() {
      this.client.subscribe(["pioreactor", "+", this.props.experiment, "throughput_calculating", "alt_media_throughput"].join("/"))
      this.client.subscribe(["pioreactor", "+", this.props.experiment, "throughput_calculating", "media_throughput"].join("/"))
  }

  addOrUpdate(hash, object, value) {
      if (Object.hasOwnProperty(hash)){
        object[hash] = value + object[hash]
      }
      else{
        object[hash] = value
      }
      return object
  }

  onMessageArrived(message) {
    const topic = message.destinationName
    const topicParts = topic.split("/")
    const payload = parseFloat(message.payloadString)
    const unit = topicParts[1]
    const objectRef = (topicParts.slice(-1)[0] === "alt_media_throughput")  ? "altMediaThroughputPerUnit"  : "mediaThroughputPerUnit"
    const totalRef = (topicParts.slice(-1)[0] === "alt_media_throughput")  ? "altMediaThroughput"  : "mediaThroughput"

    this.setState({
      [objectRef]: this.addOrUpdate(unit, this.state[objectRef], payload)
    });

    var total = Object.values(this.state[objectRef]).reduce((a, b) => a + b, 0)

    this.setState({
      [totalRef]: total
    })

  }
  render(){
    const { classes } = this.props;
    return (
    <Card>
      <CardContent>
        <Typography variant="h6" component="h2">
          <Box fontWeight="fontWeightRegular">
            Dosing
          </Box>
        </Typography>
       <TableContainer style={{ width: "100%"}}>
          <Table size="small" aria-label="media throughput">
            <TableHead>
              <TableRow>
                <TableCell style={{padding: "6px 0px"}}>Pioreactor</TableCell>
                <TableCell style={{padding: "6px 0px"}} align="right">Media</TableCell>
                <TableCell style={{padding: "6px 0px"}} align="right">Alt. Media</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow key="all">
                <TableCell style={{padding: "6px 0px"}} component="th" scope="row">
                  All Pioreactors
                </TableCell>
                <TableCell align="right" style={{fontFamily: "courier", fontSize: 14, padding: "6px 0px"}}>{this.state.mediaThroughput}mL(~{this.state.rates.all.mediaRate}mL/h)</TableCell>
                <TableCell align="right" style={{fontFamily: "courier", fontSize: 14, padding: "6px 0px"}}>{this.state.altMediaThroughput}mL(~{this.state.rates.all.altMediaRate}mL/h)</TableCell>
              </TableRow>

              {Object.keys(this.state.mediaThroughputPerUnit).map((unit) => (
                <TableRow key={unit}>
                  <TableCell style={{padding: "6px 0px"}} component="th" scope="row">
                    <PioreactorIcon style={{ fontSize: 14, verticalAlign: "middle" }} color="black"/> {(this.props.config['ui.overview.rename'] &&  this.props.config['ui.overview.rename'][unit]) ? this.props.config['ui.overview.rename'][unit] : unit}
                  </TableCell>
                  <TableCell align="right" style={{fontFamily: "courier", fontSize: 14, padding: "6px 0px"}}>{this.state.mediaThroughputPerUnit[unit]}mL(~{this.state.rates[unit] ? this.state.rates[unit].mediaRate : 0}mL/h)</TableCell>
                  <TableCell align="right" style={{fontFamily: "courier", fontSize: 14, padding: "6px 0px"}}>{this.state.altMediaThroughputPerUnit[unit]}mL(~{this.state.rates[unit] ? this.state.rates[unit].altMediaRate: 0}mL/h)</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  )}
}

export default  withStyles(useStyles)(MediaCard);
