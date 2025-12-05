import React, { useState, useEffect } from "react";
import { Box, TextField, Popover } from "@mui/material";
import { DateRange } from "react-date-range";
import "react-date-range/dist/styles.css"; // main style file
import "react-date-range/dist/theme/default.css"; // theme css file
import dayjs from "dayjs";

const DateRangeSelector = ({ startDate, endDate, onChange }) => {
    const [anchorEl, setAnchorEl] = useState(null);
    const [range, setRange] = useState([
        {
            startDate: startDate ? startDate.toDate() : new Date(),
            endDate: endDate ? endDate.toDate() : new Date(),
            key: "selection",
        },
    ]);

    // Sync internal state if props change
    useEffect(() => {
        setRange([
            {
                startDate: startDate ? startDate.toDate() : new Date(),
                endDate: endDate ? endDate.toDate() : new Date(),
                key: "selection",
            },
        ]);
    }, [startDate, endDate]);

    const handleClick = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleSelect = (ranges) => {
        const { selection } = ranges;
        setRange([selection]);

        // Propagate change to parent using dayjs
        if (onChange) {
            onChange(dayjs(selection.startDate), dayjs(selection.endDate));
        }
    };

    const open = Boolean(anchorEl);
    const id = open ? "date-range-popover" : undefined;

    const formattedDate = `${dayjs(range[0].startDate).format("DD MMM YY")} - ${dayjs(range[0].endDate).format("DD MMM YY")}`;

    return (
        <Box>
            <TextField
                value={formattedDate}
                onClick={handleClick}
                size="small"
                InputProps={{
                    readOnly: true,
                }}
                sx={{ width: "100%", cursor: "pointer", "& .MuiInputBase-input": { cursor: "pointer" } }}
            />
            <Popover
                id={id}
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{
                    vertical: "bottom",
                    horizontal: "left",
                }}
            >
                <DateRange
                    editableDateInputs={true}
                    onChange={handleSelect}
                    moveRangeOnFirstSelection={false}
                    ranges={range}
                    rangeColors={["#3b82f6"]} // Blue color
                />
            </Popover>
        </Box>
    );
};

export default DateRangeSelector;
